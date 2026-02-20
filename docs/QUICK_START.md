# 🎯 Quick Reference - Firebase Family Tree

## For Website Owner (Initial Setup)

### One-Time Setup (15 min)
1. Create Firebase project at https://console.firebase.google.com/
2. Enable Email & Google authentication
3. Create Firestore database with security rules
4. Enable Storage (optional, for images)
5. Copy Firebase config to `firebase-config.js`
6. Commit and push to GitHub

**See FIREBASE_SETUP.md for detailed instructions**

## For End Users

### Getting Started
1. Visit your website
2. Click "Create Account" or "Login"
3. Sign up with email or Google
4. Create your first family tree
5. Use JSON editor to add family members
6. Preview and share!

## Key URLs

- **Demo Tree**: `index.html` (your original tree)
- **Login/Signup**: `auth.html`
- **Dashboard**: `dashboard.html` (after login)
- **Editor**: `editor.html?id=TREE_ID`
- **Viewer**: `tree.html?id=TREE_ID`

## File Checklist

New files to commit:
- ✅ `firebase-config.js` (with your credentials)
- ✅ `auth.html`
- ✅ `auth.js`
- ✅ `dashboard.html`
- ✅ `dashboard.js`
- ✅ `dashboard.css`
- ✅ `editor.html`
- ✅ `editor.js`
- ✅ `editor.css`
- ✅ `tree.html`
- ✅ `FIREBASE_SETUP.md`
- ✅ `QUICK_START.md`

Modified files:
- ✅ `script.js` (supports Firebase trees)

## Common Commands

```bash
# Push changes to GitHub
git add .
git commit -m "Add multi-user Firebase integration"
git push origin main

# Check what's being tracked
git status
```

## Testing Checklist

After deployment:
1. ✅ Visit auth.html - Can you sign up?
2. ✅ Create account - Works?
3. ✅ Login - Works?
4. ✅ Dashboard loads - Shows empty state?
5. ✅ Create tree - Editor opens?
6. ✅ Edit JSON - Can save?
7. ✅ Preview tree - Opens in new tab?
8. ✅ Original demo - Still works at index.html?

## Firebase Console Quick Links

Once logged into [Firebase Console](https://console.firebase.google.com/):
- **Users**: Authentication → Users
- **Trees Data**: Firestore Database → trees collection
- **Rules**: Firestore Database → Rules tab
- **Usage**: Analytics or Usage & Billing

## Default Tree Structure

```json
{
  "Grandparent": "Root Person",
  "image": "",
  "birthday": "",
  "spouse": {
    "name": "Spouse",
    "image": "",
    "birthday": ""
  },
  "Parent": []
}
```

## Privacy Settings

- **Private**: Only you can see (default)
- **Public**: Anyone with link can view

## Free Tier Limits

- 50,000 reads/day
- 20,000 writes/day
- 1GB storage
- Supports ~1000+ active users/day

## Support

Issues? Check:
1. Browser console (F12)
2. Firebase Console → Firestore → View data
3. Firebase Console → Authentication → Users
4. Network tab (F12) for failed requests

## Quick Wins

Easy improvements to add later:
- Landing page (create `landing.html`)
- About page
- Custom domain
- Logo/favicon
- Email verification
- Password reset
- Tree templates
- Export to PDF
