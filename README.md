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

Because PIQ Lab is not distributed through the Mac App Store, macOS will block it the first time. Here is how to open it:

1. Go to your **Applications** folder and double-click **PIQ Lab**
2. macOS shows a warning — click **Done** to dismiss it
3. Open **System Settings** → **Privacy & Security**
4. Scroll down until you see _"PIQ Lab was blocked"_ and click **Open Anyway**
5. Click **Open** in the confirmation dialog

You only need to do this once. After that, PIQ Lab opens normally.

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
4. Copy the public URL and configure it as your integration URL in PaymentIQ

For a permanent URL that never changes, reserve a free static domain in ngrok and enter it in PIQ Lab under **URL Setup → Static domain**.
