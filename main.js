const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const axios = require('axios');
const { TOTP } = require('otpauth');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// --- Environment Configuration ---
const USERNAME = process.env.SCHWAB_USERNAME;
const PASSWORD = process.env.SCHWAB_PASSWORD;
const TOTP_SECRET = process.env.SCHWAB_TOTP_SECRET;
const APP_KEY = process.env.SCHWAB_API_KEY;
const APP_SECRET = process.env.SCHWAB_APP_SECRET;
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const SECRET_ID = 'SCHWAB_TOKENS';
const REDIRECT_URI = 'https://127.0.0.1:8182';

// --- AdsPower Configuration ---
const ADS_USER_ID = process.env.ADS_USER_ID; // The Unique ID from AdsPower
const ADS_API_BASE = 'http://127.0.0.1:50325'; // Default AdsPower Local Service port

/**
 * Helper: Human-like random delay
 */
const humanDelay = (min = 2000, max = 5000) => 
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min) + min)));

/**
 * Helper: Smart-fallback clicker to handle UI changes
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
        console.log(`🔍 Target [${targetName}] not found, initiating smart fallback...`);
        const backupLabels = ['Accept', 'Continue', 'Done', 'Agree'];
        for (const label of backupLabels) {
            const backupBtn = page.getByRole('button', { name: label, exact: false }).first();
            if (await backupBtn.isVisible()) {
                console.log(`✨ Smart-fallback successful: ${label}`);
                await backupBtn.hover();
                await backupBtn.click({ delay: Math.random() * 200 + 100 });
                return true;
            }
        }
        console.warn(`⚠️ No clickable targets found, skipping.`);
        return false;
    }
}

/**
 * GCP: Update Secret Manager and destroy old versions
 */
async function updateAndCleanupSecrets(tokenData) {
    console.log("🔍 Initializing GCP Secret Manager...");
    let options = { projectId: PROJECT_ID };
    if (process.env.GCP_SA_KEY) {
        options.credentials = JSON.parse(process.env.GCP_SA_KEY);
    }
    const client = new SecretManagerServiceClient(options);
    const parent = `projects/${PROJECT_ID}/secrets/${SECRET_ID}`;
    const payload = Buffer.from(JSON.stringify(tokenData), 'utf8');
    
    const [newVersion] = await client.addSecretVersion({
        parent: parent,
        payload: { data: payload }
    });
    console.log(`✅ New Token synced! Version: ${newVersion.name.split('/').pop()}`);

    const [versions] = await client.listSecretVersions({ parent: parent });
    for (const version of versions) {
        if (version.name !== newVersion.name && version.state !== 'DESTROYED') {
            await client.destroySecretVersion({ name: version.name });
            console.log(`🧹 Destroyed old version: ${version.name.split('/').pop()}`);
        }
    }
}

/**
 * OAuth: Exchange Auth Code for Access/Refresh Tokens
 */
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
    console.log("🚀 Starting OAuth automation via AdsPower...");
    const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?client_id=${APP_KEY}&redirect_uri=${REDIRECT_URI}`;
    
    let browser;
    try {
        // 1. Start AdsPower Browser via Local API
        console.log(`📡 Requesting AdsPower to start profile: ${ADS_USER_ID}`);
        const startResult = await axios.get(`${ADS_API_BASE}/api/v1/browser/start?user_id=${ADS_USER_ID}&open_tabs=1`);
        
        if (startResult.data.code !== 0) {
            throw new Error(`AdsPower failed: ${startResult.data.msg}`);
        }

        // 2. Connect Playwright to the AdsPower instance via CDP
        const wsEndpoint = startResult.data.data.ws.puppeteer;
        browser = await chromium.connectOverCDP(wsEndpoint);
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();

        let interceptedCode = null;
        page.on('request', request => {
            const url = request.url();
            if (url.includes('code=')) {
                const code = new URL(url).searchParams.get('code');
                if (code) interceptedCode = code;
            }
        });

        // 3. Navigation
        console.log("🌐 Navigating to authorization page...");
        await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await humanDelay(3000, 5000);

        // 4. Login
        console.log("⌨️ Entering credentials...");
        const loginInput = page.getByRole('textbox', { name: 'Login ID' });
        await loginInput.pressSequentially(USERNAME, { delay: 100 });
        
        const pwdInput = page.getByRole('textbox', { name: 'Password' });
        await pwdInput.pressSequentially(PASSWORD, { delay: 100 });
        await page.getByRole('button', { name: 'Log in' }).click();

        // 5. 2FA Handling
        console.log("🔐 Processing 2FA...");
        try {
            const codeInput = page.getByRole('spinbutton', { name: 'Security Code' });
            await codeInput.waitFor({ timeout: 15000 });
            
            const totp = new TOTP({ secret: TOTP_SECRET.replace(/\s/g, "") });
            const token = totp.generate();
            console.log(`👉 Generated TOTP: ${token}`);
            
            await codeInput.pressSequentially(token, { delay: 150 });
            await page.getByRole('button', { name: 'Continue' }).click();
        } catch (e) {
            console.error("🚨 2FA Error: Input field not found. Check for CAPTCHA or blocked IP.");
            await page.screenshot({ path: '2fa_error.png' });
            throw new Error("2FA Failed");
        }

        // 6. Authorization Clicks
        console.log("✅ Finalizing authorization clicks...");
        await humanDelay(4000, 7000);
        
        try {
            const cb = page.getByRole('checkbox', { name: 'By checking this box, I' });
            if (await cb.isVisible({ timeout: 5000 })) await cb.check();
        } catch(e) {}

        await smartClick(page, 'Continue');
        await smartClick(page, 'Accept');
        await smartClick(page, 'Continue');
        await smartClick(page, 'Done');

        // 7. Token Sync
        console.log("🔄 Intercepting Code...");
        for (let i = 0; i < 20; i++) {
            if (interceptedCode) break;
            await page.waitForTimeout(1000);
        }

        if (!interceptedCode) throw new Error("❌ Failed to intercept Code");

        const tokenData = await exchangeCodeForToken(interceptedCode.replace('%40', '@'));
        tokenData.expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;
        
        await updateAndCleanupSecrets({
            creation_timestamp: Math.floor(Date.now() / 1000),
            token: tokenData
        });

        console.log("🎉 Task completed successfully!");

    } catch (error) {
        console.error("🚨 System Crash:", error.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await axios.get(`${ADS_API_BASE}/api/v1/browser/stop?user_id=${ADS_USER_ID}`);
    }
}

main();
