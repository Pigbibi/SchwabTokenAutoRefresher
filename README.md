# Schwab Token Auto Refresher

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Stealth-orange.svg)](https://playwright.dev/)

An automated utility designed to bypass the 7-day expiration of Charles Schwab API Refresh Tokens. By leveraging a self-hosted environment and persistent browser contexts, it automates the OAuth consent flow and synchronizes credentials directly to Google Cloud Secret Manager.

## 🚀 Features

- **Service-Mode Stealth**: Optimized for Windows Service (Session 0). Runs in the background with zero UI interference.
- **Trusted Device Persistence**: Utilizes local Chrome profiles to maintain "Trusted Device" status, reducing MFA frequency.
- **Secure Cloud Sync**: Injects tokens directly into GCP Secret Manager via memory.
- **Isolated Logging**: Success logs are automatically pushed to a dedicated `logs` branch to keep the main codebase clean.

## 🛠 Setup & Installation (For Forkers)

If you have forked this repository, follow these steps to enable the automation:

### 1. Environment Requirements
- **Self-hosted Runner**: A Windows 10/11 machine (required for persistent Chrome profile and "Trusted Device" status).
- **Chrome Browser**: Latest stable version installed.
- **GCP Setup**: A Google Cloud Project with **Secret Manager API** enabled and a Service Account with `Secret Manager Secret Accessor/Version Adder` roles.

### 2. Configure GitHub Secrets
Go to **Settings > Secrets and variables > Actions** in your forked repo and add:
- `SCHWAB_USERNAME` / `SCHWAB_PASSWORD`: Your Schwab login credentials.
- `SCHWAB_TOTP_SECRET`: Your 2FA/MFA secret key.
- `SCHWAB_API_KEY` / `SCHWAB_APP_SECRET`: From your Schwab Developer App.
- `GCP_PROJECT_ID`: Your Google Cloud Project ID.
- `GCP_SA_KEY`: The JSON key of your GCP Service Account.
- `GCP_SECRET_ID`: The name of the secret in Secret Manager.
- `SCHWAB_REDIRECT_URI`: Your App's redirect URI.

### 3. Deploy the Runner
1. Download the GitHub Actions Runner on your Windows machine.
2. During configuration, when prompted `Enter the name of the runner`, give it a unique name.
3. **Crucial**: When asked `Should the runner be run as a service?`, enter **Y**.

### 4. Enable the Workflow
1. Go to the **Actions** tab of your repository.
2. Select **Schwab Token Auto Refresher** on the left.
3. Click **Enable workflow** (GitHub disables scheduled workflows on forked repos by default).
4. Manually trigger it once using **Run workflow** to test the connection.

## 📈 Architecture

1. **Trigger**: GitHub Actions scheduler (Every 3 days at 13:00 UTC).
2. **Persistence**: Session data is stored in `./schwab-local-session` to bypass repetitive security checks.
3. **Sync**: Refreshed tokens are pushed to GCP; status is logged to the `logs` branch.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
