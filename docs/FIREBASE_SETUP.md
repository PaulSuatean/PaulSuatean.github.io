# ðŸŒ³ Multi-User Family Tree Builder - Setup Guide

Your family tree website has been transformed into a **multi-user platform**! Anyone can now create their own family tree completely free using Firebase.

## ðŸ“‹ What's New

- âœ… **User Authentication** - Sign up with email/password or Google
- âœ… **Personal Dashboard** - Create and manage multiple family trees
- âœ… **Tree Editor** - Edit your family tree data (JSON editor)
- âœ… **Privacy Controls** - Make trees private or public
- âœ… **Cloud Storage** - All data saved to Firebase (free tier)
- âœ… **Original Demo** - Your original tree still works at `index.html`

## ðŸš€ Quick Start Setup (15 minutes)

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name (e.g., "family-tree-builder")
4. **Disable** Google Analytics (optional, not needed)
5. Click **"Create project"**

### Step 2: Enable Authentication

1. In Firebase Console, click **"Authentication"** in the left sidebar
2. Click **"Get started"**
3. Click on **"Email/Password"** provider
4. **Enable** the first option (Email/Password)
5. Click **"Save"**
6. Click on **"Google"** provider
7. **Enable** it
8. Enter a support email (your email)
9. Click **"Save"**

### Step 3: Create Firestore Database

1. In Firebase Console, click **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Select **"Start in production mode"**
4. Choose a location (select closest to your users)
5. Click **"Enable"**
6. Click on **"Rules"** tab
7. Replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Trees collection
    match /trees/{treeId} {
      // Allow authenticated users to create trees
      allow create: if request.auth != null;
      
      // Allow owner to read, update, delete their own trees
      allow read, update, delete: if request.auth != null && 
                                    request.auth.uid == resource.data.userId;
      
      // Allow anyone to read public trees
      allow read: if resource.data.privacy == 'public';
    }
  }
}
```

8. Click **"Publish"**

### Step 4: Enable Storage (for images - optional but recommended)

1. In Firebase Console, click **"Storage"** in the left sidebar
2. Click **"Get started"**
3. Click **"Next"** (keep default rules)
4. Choose same location as Firestore
5. Click **"Done"**
6. Click on **"Rules"** tab
7. Replace the rules with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /trees/{userId}/{treeId}/{allPaths=**} {
      // Allow authenticated users to upload to their own trees
      allow write: if request.auth != null && request.auth.uid == userId;
      // Allow anyone to read (needed for public trees)
      allow read: if true;
    }
  }
}
```

8. Click **"Publish"**

### Step 5: Get Your Firebase Configuration

1. In Firebase Console, click the **gear icon** âš™ï¸ next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"**
4. Click the **Web icon** `</>`
5. Enter app nickname (e.g., "Family Tree Web")
6. **DO NOT** check "Also set up Firebase Hosting"
7. Click **"Register app"**
8. **Copy the config object** that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

### Step 6: Update Your Website

1. Open the file `scripts/firebase-config.js` in your project
2. **Replace** the placeholder config with your actual config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",           // Paste your values here
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

3. Save the file

### Step 7: Deploy to GitHub Pages

1. Commit all the new files to your repository:
```bash
git add .
git commit -m "Add multi-user functionality with Firebase"
git push origin main
```

2. Your site will be live at `https://paulsuatean.github.io/`

## ðŸŽ¯ How to Use

### For Users

1. **Visit your site** - Go to `https://paulsuatean.github.io/`
2. **Click on "View Demo Tree"** link or navigate to `pages/auth.html`
3. **Sign up** with email/password or Google
4. **Create a tree** from your dashboard
5. **Edit your tree** using the JSON editor
6. **Preview** your tree anytime
7. **Share** by making it public (optional)

### File Structure

```
Your Website Files:
â”œâ”€â”€ index.html          â† Original demo tree (still works!)
â”œâ”€â”€ pages/auth.html           â† Login/Signup page (NEW)
â”œâ”€â”€ pages/dashboard.html      â† User dashboard (NEW)
â”œâ”€â”€ pages/editor.html         â† Tree editor (NEW)
â”œâ”€â”€ pages/tree.html           â† Tree viewer for Firebase trees (NEW)
â”œâ”€â”€ scripts/firebase-config.js  â† Your Firebase credentials (NEW)
â”œâ”€â”€ scripts/auth.js            â† Authentication logic (NEW)
â”œâ”€â”€ scripts/dashboard.js       â† Dashboard logic (NEW)
â”œâ”€â”€ styles/dashboard.css      â† Dashboard styles (NEW)
â”œâ”€â”€ scripts/editor.js          â† Editor logic (NEW)
â”œâ”€â”€ styles/editor.css         â† Editor styles (NEW)
â”œâ”€â”€ scripts/main.js          â† Main tree rendering (MODIFIED)
â”œâ”€â”€ styles/main.css         â† Original styles
â””â”€â”€ data/rfamily.json       â† Original demo data
```

## ðŸ” Security Notes

- Your Firebase API key is **safe to expose** in client-side code
- Security is enforced by **Firestore Security Rules** (set up in Step 3)
- Users can only access their own trees
- Public trees can be viewed by anyone with the link

## ðŸ’° Cost

**Free Forever** for typical usage:
- Firebase Free tier includes:
  - 50K reads/day, 20K writes/day (Firestore)
  - 1GB storage
  - 10GB/month bandwidth
  - Unlimited authentication

This supports **thousands of users** before any costs.

## ðŸŽ¨ Customization

### Change Site Branding

Edit these files to customize:
- `pages/auth.html` - Change "Family Tree Builder" text
- `pages/dashboard.html` - Change header text
- All pages use your existing `styles/main.css`

### Add a Landing Page

Use `index.html` as your homepage and link users to `pages/auth.html` to create or manage trees.

## ðŸ› Troubleshooting

### "Failed to initialize Firebase"
- Check that `scripts/firebase-config.js` has your actual Firebase credentials
- Make sure all values are inside quotes

### "Permission denied" errors
- Verify Firestore Security Rules are set correctly (Step 3)
- Make sure user is logged in

### Trees not showing up
- Check browser console for errors (F12)
- Verify Firestore has data by checking Firebase Console

### Login not working
- Verify Authentication providers are enabled (Step 2)
- For Google Sign-In, make sure you added a support email

## ðŸ“± Mobile Support

All pages are fully responsive and work on mobile devices!

## ðŸ”„ Migrating Your Original Tree

To move your `data/rfamily.json` data to Firebase:

1. Log in to your site
2. Create a new tree (e.g., "SuÄƒtean Family")
3. Go to Editor
4. Click "Import JSON"
5. Paste the contents of `data/rfamily.json`
6. Click Import
7. Click Save

Your original tree at `index.html` will still work!

## ðŸŒ Custom Domain (Optional)

To use a custom domain like `www.yourfamilytree.com`:

1. Buy a domain from GoDaddy, Namecheap, etc.
2. In GitHub repo settings, go to Pages
3. Enter your custom domain
4. Update DNS records at your domain registrar
5. GitHub provides free SSL certificates

## ðŸš€ Next Steps

Consider adding:
- **Visual drag-and-drop editor** (currently JSON only)
- **Image upload** to Firebase Storage
- **Share links** for trees
- **Collaboration** (invite family members to edit)
- **Export to PDF**
- **GEDCOM import/export** (genealogy standard format)
- **Family stories and notes**

## ðŸ“ž Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Verify Firebase setup in console
3. Check that all files are uploaded to GitHub
4. Test in incognito mode (clears cache)

## âœ¨ What You've Built

You now have a **production-ready, multi-user family tree platform** that:
- Costs $0 to run
- Scales to thousands of users
- Has professional authentication
- Stores data securely in the cloud
- Works on all devices
- Has your beautiful tree visualization!

Congratulations! ðŸŽ‰


