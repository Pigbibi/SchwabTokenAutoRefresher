const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const axios = require('axios');
const { TOTP } = require('otpauth');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const path = require('path');

// --- Configuration ---
const USERNAME = process.env.SCHWAB_USERNAME;
const PASSWORD = process.env.SCHWAB_PASSWORD;
const TOTP_SECRET = process.env.SCHWAB_TOTP_SECRET;
const APP_KEY = process.env.SCHWAB_API_KEY;
const APP_SECRET = process.env.SCHWAB_APP_SECRET;
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const SECRET_ID = process.env.GCP_SECRET_ID;
const REDIRECT_URI = process.env.SCHWAB_REDIRECT_URI;

const humanDelay = (min = 2000, max = 5000) => 
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min) + min)));

/**
 * GCP: Sync new token and prune old versions in Secret Manager.
 */
async function updateSecrets(tokenData) {
    console.log("🔍 Initializing Google Cloud Secret Manager...");
    const client = new SecretManagerServiceClient({ projectId: PROJECT_ID });
    const parent = `projects/${PROJECT_ID}/secrets/${SECRET_ID}`;
    const payload = Buffer.from(JSON.stringify(tokenData), 'utf8');
    
    const [newVersion] = await client.addSecretVersion({ parent, payload: { data: payload } });
    console.log(`✅ Token Version ${newVersion.name.split('/').pop()} synced to cloud.`);

    const [versions] = await client.listSecretVersions({ parent });
    for (const v of versions) {
        if (v.name !== newVersion.name && v.state !== 'DESTROYED') {
            await client.destroySecretVersion({ name: v.name });
            console.log(`🧹 Cleaned up old version: ${v.name.split('/').pop()}`);
        }
    }
}

async function exchangeCodeForToken(code) {
    const credentials = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString('base64');
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
    });
    const response = await axios.post('https://api.schwabapi.com/v1/oauth/token', params.toString(), {
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data;
}

async function main() {
    console.log("🚀 Starting Schwab OAuth task...");
    const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?client_id=${APP_KEY}&redirect_uri=${REDIRECT_URI}`;
    
    // Using absolute path to ensure stability in Windows Service Mode.
    const userDataDir = path.resolve(__dirname, 'schwab-local-session'); 

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false, // Must be false for Schwab's financial anti-bot systems
        channel: 'chrome', 
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--no-sandbox',
            '--window-position=-32000,-32000', // Keeps window off-screen
            '--window-size=1,1'
        ],
        viewport: null
    });

    const page = context.pages()[0] || await context.newPage();
    let interceptedCode = null;

    page.on('request', r => {
        if (r.url().includes('code=')) interceptedCode = new URL(r.url()).searchParams.get('code');
    });

    try {
        console.log("🌐 Navigating to Schwab authorization portal...");
        await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await humanDelay(3000, 5000);

        console.log("⌨️ Entering credentials...");
        await page.getByRole('textbox', { name: 'Login ID' }).pressSequentially(USERNAME, { delay: 100 });
        await page.getByRole('textbox', { name: 'Password' }).pressSequentially(PASSWORD, { delay: 100 });
        await page.getByRole('button', { name: 'Log in' }).click();

        // --- 🔐 4. Strict 2FA Handling ---
        console.log("🔐 Checking for 2FA screen...");
        try {
            const codeInput = page.getByRole('spinbutton', { name: 'Security Code' });
            await codeInput.waitFor({ timeout: 15000 });
            
            const token = new TOTP({ secret: TOTP_SECRET.replace(/\s/g, "") }).generate();
            console.log(`👉 TOTP successfully generated: ${token}`);
            
            await codeInput.pressSequentially(token, { delay: 150 });
            await page.getByRole('button', { name: 'Continue' }).click();
        } catch (e) {
            await page.screenshot({ path: 'fatal_2fa_missing.png', fullPage: true });
            throw new Error("🚨 FATAL: 2FA input field not found! Script stopped to protect account.");
        }

        // --- 5. Approvals ---
        console.log("✅ Handling authorization approvals...");
        await humanDelay(5000, 8000);
        const labels = ['Continue', 'Accept', 'Done'];
        for (const label of labels) {
            try {
                const btn = page.getByRole('button', { name: label, exact: false }).first();
                if (await btn.isVisible({ timeout: 5000 })) {
                    await btn.click();
                    await humanDelay(2000, 4000);
                }
            } catch (e) {}
        }

        // --- 6. Interception ---
        for (let i = 0; i < 20 && !interceptedCode; i++) { await page.waitForTimeout(1000); }
        if (!interceptedCode) throw new Error("❌ Error: Authorization code interception failed.");

        const tokenDict = await exchangeCodeForToken(interceptedCode.replace('%40', '@'));
        tokenDict.expires_at = Math.floor(Date.now() / 1000) + tokenDict.expires_in;
        
        await updateSecrets({
            creation_timestamp: Math.floor(Date.now() / 1000),
            token: tokenDict
        });

        console.log("🎉 SUCCESS: Refresh token lifecycle completed.");

    } catch (err) {
        console.error("🚨 Execution Failed:", err.message);
        await page.screenshot({ path: 'last_error_state.png' });
        process.exit(1);
    } finally {
        if (context) await context.close();
    }
}

main();
