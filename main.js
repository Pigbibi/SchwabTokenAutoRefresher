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

// Human-like random delay function
const humanDelay = (min = 2000, max = 5000) => 
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min) + min)));

/**
 * 💡 Smart-fallback click helper:
 * Prioritizes clicking the recorded ID/role. If not found, automatically seeks keyword-based buttons.
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
        console.log(`🔍 Target [${targetName}] not found on primary path, initiating smart keyword search...`);
        const backupLabels = ['Accept', 'Continue', 'Done', 'Agree'];
        for (const label of backupLabels) {
            const backupBtn = page.getByRole('button', { name: label, exact: false }).first();
            if (await backupBtn.isVisible()) {
                console.log(`✨ Smart-fallback successful, found and clicked: ${label}`);
                await backupBtn.hover();
                await backupBtn.click({ delay: Math.random() * 200 + 100 });
                return true;
            }
        }
        console.warn(`⚠️ Smart search found no clickable targets, skipping this step.`);
        return false;
    }
}

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
    console.log(`✅ New Token synced successfully! Version: ${newVersion.name.split('/').pop()}`);

    const [versions] = await client.listSecretVersions({ parent: parent });
    for (const version of versions) {
        if (version.name !== newVersion.name && version.state !== 'DESTROYED') {
            await client.destroySecretVersion({ name: version.name });
            console.log(`🧹 Destroyed old version: ${version.name.split('/').pop()}`);
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
    console.log("🚀 Starting OAuth automation task...");
    const authUrl = `https://api.schwabapi.com/v1/oauth/authorize?client_id=${APP_KEY}&redirect_uri=${REDIRECT_URI}`;
    
    const userDataDir = './schwab-chrome-session'; 

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-position=-32000,-32000'
        ],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        viewport: null,
        permissions: ['geolocation']
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.navigator.chrome = { runtime: {} };
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    let interceptedCode = null;
    page.on('request', request => {
        const url = request.url();
        if (url.includes('code=')) {
            const urlObj = new URL(url);
            const code = urlObj.searchParams.get('code');
            if (code) interceptedCode = code;
        }
    });

    try {
        console.log("🌐 1. Navigating to authorization page...");
        await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await humanDelay(3000, 5000);

        console.log("⌨️ 2. Entering credentials with human-like typing...");
        const loginInput = page.getByRole('textbox', { name: 'Login ID' });
        await loginInput.click();
        await loginInput.pressSequentially(USERNAME, { delay: 150 + Math.random() * 100 });
        await humanDelay(1000, 2000);

        const pwdInput = page.getByRole('textbox', { name: 'Password' });
        await pwdInput.click();
        await pwdInput.pressSequentially(PASSWORD, { delay: 150 + Math.random() * 100 });
        await humanDelay(1500, 3000);

        await page.getByRole('button', { name: 'Log in' }).click();

        console.log("🔐 3. Processing 2FA code...");
        try {
            const codeInput = page.getByRole('spinbutton', { name: 'Security Code' });
            await codeInput.waitFor({ timeout: 15000 });
            await humanDelay(3000, 5000); 

            const totp = new TOTP({ secret: TOTP_SECRET.replace(/\s/g, "") });
            const token = totp.generate();
            console.log(`   👉 Generated TOTP: ${token}`);
            
            await codeInput.click();
            await codeInput.pressSequentially(token, { delay: 200 });
            await humanDelay(1000, 2000);
            await page.getByRole('button', { name: 'Continue' }).click();
        } catch (e) {
            console.error("🚨 Fatal Error: 2FA input field not found! Likely blocked by anti-bot systems or page load timed out.");
            await page.screenshot({ path: '2fa_failed_screenshot.png', fullPage: true });
            throw new Error("2FA Phase Failed - Script stopped to prevent wrong clicks.");
        }

        console.log("✅ 4. Executing account authorization checkbox and smart clicks...");
        await humanDelay(3000, 6000);

        try {
            const cb = page.getByRole('checkbox', { name: 'By checking this box, I' });
            if (await cb.isVisible({ timeout: 5000 })) {
                await cb.check();
                await humanDelay(500, 1500);
            }
        } catch(e) {}

        await smartClick(page, 'Continue', '#submit-btn');
        await humanDelay(2000, 4000);

        await smartClick(page, 'Accept');
        await humanDelay(2000, 4000);

        await smartClick(page, 'Continue');
        await humanDelay(2000, 4000);

        await smartClick(page, 'Done');

        console.log("🔄 5. Intercepting and syncing Code...");
        for (let i = 0; i < 25; i++) {
            if (interceptedCode) break;
            const currentUrl = page.url();
            if (currentUrl.includes('code=')) {
                interceptedCode = new URL(currentUrl).searchParams.get('code');
                break;
            }
            await page.waitForTimeout(1000);
        }

        if (!interceptedCode) throw new Error("❌ Failed to intercept Code");

        const tokenDict = await exchangeCodeForToken(interceptedCode.replace('%40', '@'));
        tokenDict.expires_at = Math.floor(Date.now() / 1000) + tokenDict.expires_in;
        await updateAndCleanupSecrets({
            creation_timestamp: Math.floor(Date.now() / 1000),
            token: tokenDict
        });
        console.log("🎉 OAuth automation task completed!");

    } catch (error) {
        console.error("🚨 System crashed...");
        await page.screenshot({ path: 'error_screenshot.png', fullPage: true });
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (context) await context.close();
    }
}

main();
