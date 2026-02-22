# Local Development Setup with Firebase Emulator

This guide will help you test your application locally without deploying to Firebase each time.

## Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher)
- Firebase CLI (already installed globally in your system)

## Quick Start

### Step 1: Initialize Firebase Emulator (One-time setup)

Run this command in your project directory:

```bash
firebase init emulator
```

When prompted, select:
- Keep existing configuration (select these emulators):
  - **Authentication Emulator**
  - **Firestore Emulator**
  - **Storage Emulator** (optional, if you use it)
- Port for Authentication Emulator: `9099` (default)
- Port for Firestore Emulator: `8080` (default)
- Port for Storage Emulator: `5001` (optional)
- Port for Hosting Emulator: `5000` (default)

This creates a `.firebaserc` and updates `firebase.json` with emulator configuration.

### Step 2: Start the Firebase Emulator

```bash
firebase emulators:start --only auth,firestore,storage
```

You should see output like:
```
âœ” All emulators ready! It is now safe to open the emulator UI.

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Emulator UI (Web): http://localhost:4000                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Authentication Emulator: http://localhost:9099              â”‚
â”‚ Cloud Firestore Emulator: http://localhost:8080             â”‚
â”‚ Storage Emulator: http://localhost:5001                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Step 3: Start a Local Web Server

Open a new terminal and run:

```bash
# Using Python 3
python -m http.server 5000

# Using Python 2
python -m SimpleHTTPServer 5000

# Using Node.js (if you have http-server installed)
npx http-server -p 5000

# or using Node directly (requires no installation)
node -e "require('http').createServer((q,s)=>require('fs').createReadStream('.'+q.url).pipe(s)).listen(5000)" & echo "Server running at http://localhost:5000"
```

### Step 4: Access Your App

Open your browser and go to: `http://localhost:5000`

The `scripts/firebase-config.js` will **automatically detect** you're on localhost and connect to the local emulator instead of your production Firebase.

## How It Works

Your updated `scripts/firebase-config.js` checks if:
- Hostname is `localhost` or `127.0.0.1`
- Port is `5000` (Firebase Emulator default)

If both are true, it connects to the local emulators. Otherwise, it uses your production Firebase.

## Monitor Emulated Data

While the emulator is running, you can view live data at:
- **Emulator Dashboard**: http://localhost:4000
- Check Firestore data, test authentication, etc.

## Testing Workflow

1. **Terminal 1**: `firebase emulators:start --only auth,firestore,storage`
2. **Terminal 2**: `python -m http.server 5000` (or your preferred server)
3. **Browser**: http://localhost:5000
4. Make code changes â†’ Refresh browser (F5)
5. No deployment needed!

## Useful Commands

```bash
# Clear all emulator data and restart
firebase emulators:start --only auth,firestore,storage --import=./emulator-data

# Export emulator data for later
firebase emulators:export ./backup-data

# Stop emulator (Ctrl+C in terminal)
```

## Switching Back to Production

Just close the emulator and your local server. The app will connect to production Firebase when accessed from the deployed URL.

## Troubleshooting

**Port Already in Use?**
```bash
# Check what's using a port
netstat -ano | findstr :5000

# Kill the process (Windows)
taskkill /PID <PID> /F

# Or use a different port
firebase emulators:start --only auth,firestore,storage --project=demo
```

**Firebase SDK not connecting?**
- Make sure you're accessing via `localhost:5000` (exact domain matters)
- Check browser console (F12) for log messages
- Verify emulator is running in the other terminal

**Can't find Python server?**
```bash
# Install http-server globally (one-time)
npm install -g http-server

# Then run
http-server -p 5000
```

---

ðŸ’¡ **Tip**: You can use VS Code's "Live Server" extension for even easier local development!


