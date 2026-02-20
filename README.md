# 🚀 Schwab Token Auto Refresher

![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![Playwright](https://img.shields.io/badge/Playwright-Stealth-orange)

**Schwab Token Auto Refresher** is a robust automation utility designed for Charles Schwab API users. It solves the pain point of the **7-day expiration** of the official Refresh Token by automating the OAuth consent flow, ensuring your quantitative trading systems (like TQQQ/SOXL strategies) remain active 24/7 without manual intervention.

## ✨ Key Features

- **Smart-Heuristic Clicking**: Features a `smartClick` engine that dynamically identifies and completes the `Continue -> Accept -> Done` sequence, even if Schwab updates their UI layout.
- **Advanced Human Mimicry**: Simulates realistic typing cadences (150ms delay), randomized pauses, and mouse hover actions to bypass sophisticated anti-bot detections.
- **Cloud-Native Integration**: Directly injects tokens into **Google Cloud Secret Manager** via memory. No sensitive JSON files are stored on disk, ensuring maximum security.
- **Headless Cloud Execution**: Fully optimized for **GitHub Actions (ubuntu-latest)** environments.
- **Auto-Activity Logs**: Automatically pushes execution logs to the repository to prevent GitHub Actions from being disabled due to repo inactivity.

## 🏗️ Architecture

1. **GitHub Actions**: Acts as the scheduler, triggering the refresh every 24 hours.
2. **Playwright (Chromium + Stealth)**: Handles the browser automation, 2FA (TOTP) entry, and consent clicking.
3. **GCP Secret Manager**: Serves as the secure vault for the generated OAuth tokens.
4. **Trading Client (e.g., Cloud Run)**: Decoupled client that fetches the latest token via API for seamless trading.

## 🛠️ Quick Start

### 1. Prerequisites
- A Google Cloud Project with **Secret Manager API** enabled.
- A Service Account with `Secret Manager Admin` roles.
- A Schwab Developer App with a valid `Redirect URI` (default: `https://127.0.0.1:8182`).

### 2. Configure GitHub Secrets
Navigate to `Settings > Secrets and variables > Actions` and add:

| Name | Description |
| :--- | :--- |
| `SCHWAB_USERNAME` | Your Schwab login username |
| `SCHWAB_PASSWORD` | Your Schwab login password |
| `SCHWAB_TOTP_SECRET` | 32-character 2FA secret key (remove spaces) |
| `SCHWAB_API_KEY` | Schwab App Key |
| `SCHWAB_APP_SECRET` | Schwab App Secret |
| `GCP_PROJECT_ID` | Your Google Cloud Project ID |
| `GCP_SA_KEY` | Full JSON content of your GCP Service Account Key |

### 3. Deployment
Simply fork this repository and push your changes. The workflow is located at `.github/workflows/main.yml`.

## 📅 Scheduled Tasks
- **Frequency**: Every 24 hours.
- **Time**: 22:00 Beijing Time (14:00 UTC), ideal for pre-market preparation.
- **Log**: View `last_run.txt` for the latest successful sync timestamp.

## 📜 Disclaimer
This project is for educational and personal research purposes only. It is not affiliated with Charles Schwab & Co., Inc. Use it at your own risk.

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for more information.
