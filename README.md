# Schwab Token Auto Refresher

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Stealth-orange.svg)](https://playwright.dev/)

An automated utility designed to bypass the 7-day expiration of Charles Schwab API Refresh Tokens. It leverages GitHub-hosted runners (`ubuntu-latest`) with 7GB RAM to run an official Google Chrome instance, automating the OAuth consent flow and synchronizing credentials directly to Google Cloud Secret Manager.

## 🚀 Features

- **GitHub-Hosted Efficiency**: Runs entirely on GitHub's infrastructure (7GB RAM), eliminating the need for private VPS maintenance.
- **Official Chrome Integration**: Dynamically installs the retail version of Google Chrome (.deb) to ensure maximum browser trust and bypass bot detection.
- **Stealth-Mode Automation**: Powered by `playwright-extra` and `stealth` plugins to emulate human-like behavior and bypass sophisticated anti-bot challenges.
- **Automated Virtual Display**: Uses `xvfb-run` within the CI environment to handle headed browser interactions without a physical monitor.
- **Secure Cloud Sync**: Injects refreshed tokens directly into Google Cloud Secret Manager via memory, ensuring no sensitive data is stored in the repo.
- **Isolated Logging**: Success timestamps are automatically committed to a dedicated `logs` branch to keep the main commit history clean.

## 🛠 Setup & Installation

If you have forked this repository, follow these steps to enable the automation:

### 1. Configure GitHub Secrets
Go to **Settings > Secrets and variables > Actions** in your repo and add:

| Secret Name | Description |
| :--- | :--- |
| `SCHWAB_USERNAME` | Your Schwab account Login ID |
| `SCHWAB_PASSWORD` | Your Schwab account Password |
| `SCHWAB_TOTP_SECRET` | Your 2FA/MFA secret key (Base32) |
| `SCHWAB_API_KEY` | Your Schwab Developer App Client ID |
| `SCHWAB_APP_SECRET` | Your Schwab Developer App Client Secret |
| `GCP_PROJECT_ID` | Your Google Cloud Project ID |
| `GCP_SA_KEY` | JSON key for a GCP Service Account with Secret Manager permissions |
| `GCP_SECRET_ID` | The name of the secret in Secret Manager |
| `SCHWAB_REDIRECT_URI` | Your App's registered redirect URI |

### 2. Enable the Workflow
1. Navigate to the **Actions** tab of your repository.
2. Select **Schwab Token Auto Refresher** from the left sidebar.
3. Click **Enable workflow** (GitHub disables scheduled workflows on forks by default).
4. (Optional) Manually trigger the flow using **Run workflow** to verify the configuration.

## 📈 Architecture

1. **Trigger**: Triggered by GitHub Actions scheduler every 3 days at 13:00 UTC.
2. **Environment**: Spin up an `ubuntu-latest` runner, install Google Chrome stable, and initialize a virtual display via `xvfb`.
3. **Execution**: Playwright-stealth navigates the OAuth flow, inputs credentials, generates TOTP, and intercepts the redirect code.
4. **Synchronization**: The utility exchanges the code for tokens and updates GCP Secret Manager.
5. **Logging**: Updates `last_run.txt` on the `logs` branch to confirm a successful refresh.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
