const { firefox } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
firefox.use(stealth);

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
 * 💡 Smart-fallback click helper
 */
async function smartClick(page, targetName, selector = null, timeout = 10000) {
    try {
        console.log(`🎯 Attempting to find target button: ${targetName}`);
        let target = selector ? page.locator(selector) : page.getByRole('button', { name: targetName, exact: false });
        
        await target.waitFor({ state: 'visible', timeout });
        await target.hover(); 
        await page.waitForTimeout(500);
        await target.click({ delay: Math.random() * 200 + 100 });
        console.log(`✅ Successfully clicked target button: ${targetName}`);
        return true;
    } catch (e) {
        console.log(`🔍 Target [${targetName}] not found, using smart-fallback...`);
        const backupLabels = ['Accept', 'Continue', 'Done', 'Agree'];
        for (const label of backupLabels) {
            const backupBtn = page.getByRole('button', { name: label, exact: false }).first();
            if (await backupBtn.isVisible()) {
                await backupBtn.click({ delay: Math.random() * 200 + 100 });
                return true;
            }
        }
        return false;
    }
}

async function updateAndCleanupSecrets(tokenData) {
    console.log("🔍 Initializing GCP Secret Manager...");
    let options = { projectId: PROJECT_ID };
    if (process.env.GCP_SA_KEY) { options.credentials = JSON.parse(process.env.GCP_SA_KEY); }
    const client = new SecretManagerServiceClient(options);
    const parent = `projects/${PROJECT_ID}/secrets/${SECRET_ID}`;
    const payload = Buffer.from(JSON.stringify(tokenData), 'utf8');
    const [newVersion] = await client.addSecretVersion({ parent, payload: { data: payload } });
    console.log(`✅ Token Version ${newVersion.name.split('/').pop()} synced.`);
    const [versions] = await client.listSecretVersions({ parent });
    for (const v of versions) {
        if (v.name !== newVersion.name && v.state !== 'DESTROYED') {
            await client.destroySecretVersion({ name: v.name });
        }
    }
}

async function exchangeCodeForToken(code) {
    const credentials = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString('base64');
    const params = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
    const response = await axios.post('https://api.schwabapi.com/v1/oauth/token', params.toString(), {
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
}

async function main() {
    console.log("🚀 Starting Firefox OAuth task on Ubuntu...");
    const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?client_id=${APP_KEY}&redirect_uri=${REDIRECT_URI}`;
    const userDataDir = path.resolve(__dirname, 'schwab-local-session'); 

    const context = await firefox.launchPersistentContext(userDataDir, {
        headless: false,
        args: ['--width=1280', '--height=800'],
        firefoxUserPrefs: {
            'dom.webdriver.enabled': false,
            'useAutomationExtension': false,
            'browser.cache.disk.enable': false
        },
        viewport: { width: 1280, height: 800 }
    });

    const page = context.pages()[0] || await context.newPage();
    let interceptedCode = null;

    page.on('request', r => {
        if (r.url().includes('code=')) interceptedCode = new URL(r.url()).searchParams.get('code');
    });

    try {
        console.log("🌐 1. Navigating to auth page...");
        await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await humanDelay(3000, 5000);

        console.log("⌨️ 2. Entering credentials...");
        await page.getByRole('textbox', { name: 'Login ID' }).fill(USERNAME);
        await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
        await page.getByRole('button', { name: 'Log in' }).click();

        console.log("🔐 3. Processing 2FA code...");
        try {
            const codeInput = page.getByRole('spinbutton', { name: 'Security Code' });
            await codeInput.waitFor({ timeout: 20000 });
            const token = new TOTP({ secret: TOTP_SECRET.replace(/\s/g, "") }).generate();
            console.log(`👉 Generated TOTP: ${token}`);
            await codeInput.fill(token);
            await page.getByRole('button', { name: 'Continue' }).click();
        } catch (e) {
            await page.screenshot({ path: 'fatal_2fa_missing.png' });
            throw new Error("🚨 2FA Input not found.");
        }

        console.log("✅ 4. Authorizing...");
        await humanDelay(6000, 10000);

        try {
            const cb = page.getByRole('checkbox', { name: /By checking this box/i });
            if (await cb.isVisible({ timeout: 5000 })) { await cb.check(); }
        } catch (e) {}

        await smartClick(page, 'Continue', '#submit-btn');
        await humanDelay(3000, 5000);
        await smartClick(page, 'Accept');
        await humanDelay(3000, 5000);
        await smartClick(page, 'Continue');
        await humanDelay(3000, 5000);
        await smartClick(page, 'Done');

        console.log("🔄 5. Intercepting Code...");
        for (let i = 0; i < 30 && !interceptedCode; i++) { await page.waitForTimeout(1000); }
        if (!interceptedCode) throw new Error("❌ Interception failed.");

        const tokenDict = await exchangeCodeForToken(interceptedCode.replace('%40', '@'));
        tokenDict.expires_at = Math.floor(Date.now() / 1000) + tokenDict.expires_in;
        await updateAndCleanupSecrets({ creation_timestamp: Math.floor(Date.now() / 1000), token: tokenDict });
        console.log("🎉 SUCCESS!");

    } catch (err) {
        console.error("🚨 Failure:", err.message);
        await page.screenshot({ path: 'last_error_state.png' });
        process.exit(1);
    } finally {
        await context.close();
    }
}
main();