# 🚀 Schwab Token Auto Refresher

![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![Playwright](https://img.shields.io/badge/Playwright-Stealth-orange)
![Runner](https://img.shields.io/badge/Runner-Self--hosted-blueviolet)

**Schwab Token Auto Refresher** is a high-stealth automation utility designed for Schwab Developer API users. It solves the **7-day expiration** constraint of the official Refresh Token by automating the OAuth consent flow on a persistent local environment, ensuring the quantitative strategies remain uninterrupted.

## ✨ Key Features

- **Service-Mode Stealth**: Optimized for Windows Service (Session 0) execution. Runs completely in the background with **zero taskbar icons** or pop-ups.
- **Smart-Heuristic Engine**: Automatically handles the `Terms & Conditions Checkbox -> Continue -> Accept -> Done` sequence with dynamic UI discovery.
- **Trusted Device Persistence**: Utilizes `launchPersistentContext` to maintain Schwab's "Trusted Device" status, bypassing the "Shadow Ban" fake-password errors.
- **Zero-File GCP Sync**: Directly injects tokens into **Google Cloud Secret Manager** using in-memory Service Account keys. No sensitive JSON files are stored on disk.
- **Windows-Optimized CI/CD**: Fully compatible with PowerShell syntax for seamless updates on Windows Self-hosted Runners.

## 🏗️ Architecture

1. **GitHub Actions (Self-hosted)**: Triggers the task everyday on the local machine.
2. **Playwright (Chrome + Stealth)**: Executes the browser automation using the real local Chrome installation.
3. **Persistent Session**: Stores session cookies locally to bypass recurring 2FA prompts.
4. **GCP Secret Manager**: Acts as the final secure destination for the refreshed tokens.

## 🛠️ Quick Start

### 1. Configure GitHub Secrets
Add the following secrets to the repository (`Settings > Secrets > Actions`):

| Name | Description |
| :--- | :--- |
| `SCHWAB_USERNAME` | Schwab login username |
| `SCHWAB_PASSWORD` | Schwab login password |
| `SCHWAB_TOTP_SECRET` | 32-character 2FA secret key |
| `SCHWAB_API_KEY` | Schwab App Client ID |
| `SCHWAB_APP_SECRET` | Schwab App Client Secret |
| `GCP_PROJECT_ID` | Google Cloud Project ID |
| `GCP_SECRET_ID` | The name of secret |
| `SCHWAB_REDIRECT_URI` | OAuth Redirect URI |
| `GCP_SA_KEY` | Full JSON content of GCP Service Account Key |

### 2. Setup Local Runner (Service Mode)
To run invisibly on Windows:
1. Download and extract the GitHub Actions Runner.
2. Run `./config.cmd` and follow the prompts.
3. **Crucial**: When asked to install as a **Service**, select **(Y)**.
4. Ensure the local Google Chrome is installed and updated.

### 3. Deployment
Push the code to the `main` branch. The workflow will automatically trigger based on the defined cron schedule.

## 📅 Scheduled Tasks
- **Frequency**: Every 24 hours.
- **Time**: 21:00 Beijing Time (13:00 UTC), perfect for daily pre-market preparation.
- **Logs**: Successful runs update `last_run.txt` automatically.

## 📜 Disclaimer
This project is for educational and personal research purposes only. Use of this automation must comply with Charles Schwab's terms of service. The author is not responsible for any account restrictions or financial losses.

## ⚖️ License
Distributed under the MIT License.
