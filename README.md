# PIQ Lab

A desktop app for configuring and running a local mock PaymentIQ integration API — without needing a real merchant backend.

## Installation

### Step 1 — Download

Go to the [latest release](https://github.com/jonashelander/piq-lab-desktop/releases/latest) and download the correct file for your Mac:

- **Apple Silicon** (M1, M2, M3, M4) → download `PIQ Lab-x.x.x-arm64.dmg`
- **Intel Mac** → download `PIQ Lab-x.x.x.dmg`

Not sure which Mac you have? Click the Apple menu () → **About This Mac**. If it says **Apple M1/M2/M3/M4**, you have Apple Silicon. If it says **Intel**, you have Intel.

### Step 2 — Install

1. Open the downloaded `.dmg` file
2. Drag **PIQ Lab** into the **Applications** folder

### Step 3 — Open for the first time

Because PIQ Lab is not distributed through the Mac App Store, macOS will block it the first time with a message saying the app is "damaged". This is a standard macOS security measure for unsigned apps — the app is fine.

To fix it, open the **Terminal** app (press ⌘ Space, type `Terminal`, press Return) and run this command:

```
xattr -cr /Applications/PIQ\ Lab.app
```

Press Return. Then double-click **PIQ Lab** in your Applications folder — it will open normally.

You only need to do this once.

## What it does

PIQ Lab runs a local HTTP server on port `3000` that responds to PaymentIQ integration requests. You can configure exactly what each endpoint returns — user data, success/failure, error codes, 3DS2 fields — and switch between saved response sets on the fly.

### Endpoints

| Endpoint | Description |
|---|---|
| `POST /verifyuser` | Returns user profile and optional 3DS2 data |
| `POST /authorize` | Authorizes a payment |
| `POST /transfer` | Transfers funds |
| `POST /cancel` | Cancels a payment |
| `POST /notification` | Receives a payment notification |
| `POST /lookupuser` | Looks up a user |
| `POST /signin` | Signs in a user |

### URL Setup (ngrok)

PaymentIQ is a cloud service and cannot reach `localhost` directly. PIQ Lab has built-in [ngrok](https://ngrok.com) support to expose your local server via a public URL.

1. Create a free account at [ngrok.com](https://ngrok.com)
2. Copy your **Authtoken** from the ngrok dashboard
3. In PIQ Lab, go to **URL Setup** and paste the token
4. Copy the public URL
5. In PaymentIQ Backoffice, go to **Admin → MerchantConfig** and:
   - Set `apiIntegrationUrl` to the copied URL
   - Set `integrationService` to `standardMerchantIntegrationService` (instead of `mockMerchantIntegrationService`)

For a permanent URL that never changes, reserve a free static domain in ngrok and enter it in PIQ Lab under **URL Setup → Static domain**. This way you only need to configure the URL in PaymentIQ once.
