# Schwab Token Auto Refresher

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Stealth-orange.svg)](https://playwright.dev/)

An automated utility designed to bypass the 7-day expiration of Charles Schwab API Refresh Tokens. By leveraging a self-hosted environment and persistent browser contexts, it automates the OAuth consent flow and synchronizes credentials directly to Google Cloud Secret Manager.

## Features

- **Service-Mode Stealth**: Optimized for Windows Service (Session 0). Runs completely in the background with zero UI interference.
- **Trusted Device Persistence**: Utilizes local Chrome profiles to maintain "Trusted Device" status, significantly reducing MFA frequency.
- **Smart-Heuristic Automation**: Dynamically identifies and interacts with Terms & Conditions checkboxes and authorization buttons.
- **Secure Cloud Sync**: Injects tokens directly into GCP Secret Manager via memory using Service Account keys.
- **Invisible Execution**: Implements off-screen window positioning (-32000, -32000) for non-disruptive automation.

## Prerequisites

- **Environment**: Windows 10/11 (Self-hosted Runner recommended).
- **Browser**: Google Chrome (Latest stable version).
- **Runtime**: Node.js v20 or higher.
- **Cloud**: Google Cloud Project with Secret Manager API enabled.

## Setup & Installation

### 1. Local Environment
Clone the repository and install dependencies:
1. git clone https://github.com/Pigbibi/SchwabTokenAutoRefresher.git
2. cd SchwabTokenAutoRefresher
3. npm install

### 2. Configure GitHub Secrets
Navigate to Settings > Secrets > Actions and configure the following:
- SCHWAB_USERNAME / SCHWAB_PASSWORD: Account credentials.
- SCHWAB_TOTP_SECRET: 2FA secret key.
- SCHWAB_API_KEY / SCHWAB_APP_SECRET: Schwab Developer App credentials.
- GCP_PROJECT_ID / GCP_SA_KEY: Google Cloud credentials.
- GCP_SECRET_ID / SCHWAB_REDIRECT_URI: Configuration for Secret Manager and OAuth.

### 3. Deploy as a Service
When configuring the GitHub Actions Runner, ensure you select "Y" for the "Install as Service" prompt. This ensures the script runs invisibly in the background.

## Architecture

1. **Trigger**: GitHub Actions scheduler (Cron: 0 13 */3 * *).
2. **Execution**: Local Runner invokes Playwright with the system's Chrome channel.
3. **Persistence**: Session data is stored in ./schwab-local-session to bypass repetitive security checks.
4. **Sync**: Refreshed tokens are pushed to GCP Secret Manager; execution logs are updated in last_run.txt.

## Disclaimer
This project is for educational and personal use only. Use at your own risk. The author is not responsible for any account-related issues or financial losses.

## License
Distributed under the MIT License. See LICENSE for more information.
