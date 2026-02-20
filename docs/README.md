# 🌳 Ancestrio - Multi-User Platform

Transform your family tree into a platform where anyone can create and share their own family history!

## 🎯 What Is This?

This is a **complete multi-user family tree application** that lets people:
- Create accounts (email or Google)
- Build multiple family trees
- Edit trees with an easy JSON editor
- Share trees publicly or keep them private
- View interactive, zoomable trees with all the original features

**Best part: It's 100% FREE to run!**

---

## 🚀 Quick Start (3 Steps)

### Step 1: Set up Firebase (15 min)
Read **`FIREBASE_SETUP.md`** for detailed instructions.

**TL;DR:**
1. Create Firebase project at console.firebase.google.com
2. Enable Email & Google authentication
3. Create Firestore database with security rules
4. Copy config to `firebase-config.js`

### Step 2: Deploy (2 min)
```bash
git add .
git commit -m "Add multi-user Firebase functionality"
git push origin main
```

### Step 3: Test (5 min)
1. Visit `yourusername.github.io/auth.html`
2. Create account
3. Create a family tree
4. Edit and save
5. Preview your tree!

---

## 📚 Documentation Files

- **`FIREBASE_SETUP.md`** ← START HERE! Complete setup guide
- **`QUICK_START.md`** - Quick reference and commands
- **`IMPLEMENTATION_SUMMARY.md`** - What was built and how it works
- **`README.md`** - This file

---

## 🌐 Pages

### For Users:
- **`landing.html`** - Marketing homepage (optional)
- **`auth.html`** - Login/signup
- **`dashboard.html`** - Manage your trees
- **`editor.html`** - Edit tree data
- **`tree.html`** - View trees from Firebase

### Demo:
- **`index.html`** - Original demo tree (still works!)

---

## ⚙️ Key File to Configure

**You MUST update this file before deploying:**

### `firebase-config.js`
Replace placeholder values with your Firebase credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Get these from Firebase Console → Project Settings → Your apps

---

## 💰 Costs

**$0 with Firebase Free Tier:**
- 50K reads/day
- 20K writes/day  
- 1GB storage
- Unlimited auth

Supports thousands of users before any costs!

---

## 🎨 Features

### Authentication
- ✅ Email/password signup
- ✅ Google Sign-In
- ✅ Secure sessions
- ✅ Password reset (built-in Firebase)

### Dashboard
- ✅ Create unlimited trees
- ✅ Edit or delete trees
- ✅ Privacy controls (public/private)
- ✅ Tree metadata (name, description, stats)

### Editor
- ✅ JSON editor with validation
- ✅ Format and validate tools
- ✅ Import/export JSON
- ✅ Auto-save warnings
- ✅ Real-time preview

### Tree Viewer
- ✅ All original features work:
  - Zoom and pan
  - Search people
  - Birthday calendar
  - Globe view
  - DNA lineage lines
  - Theme switcher
  - Focus mode
- ✅ Loads from Firebase
- ✅ Respects privacy settings
- ✅ Shareable links

---

## 🔐 Security

- ✅ Firestore Security Rules protect data
- ✅ Users can only access their own trees
- ✅ Public trees viewable but not editable
- ✅ All traffic over HTTPS
- ✅ API key safe to expose (security is server-side)

---

## 📱 Mobile Support

Fully responsive on:
- ✅ Phones (iOS & Android)
- ✅ Tablets
- ✅ Desktops
- ✅ Touch gestures supported

---

## 🎓 Tech Stack

- **Frontend:** Vanilla JavaScript, D3.js, HTML5, CSS3
- **Backend:** Firebase (Firestore, Authentication, Storage)
- **Hosting:** GitHub Pages (free)
- **CDN:** Google Fonts, Firebase CDN

---

## 🚀 Deployment Checklist

Before going live:

- [ ] Firebase project created
- [ ] Authentication enabled (Email + Google)
- [ ] Firestore database created
- [ ] Security rules deployed
- [ ] Storage enabled (optional)
- [ ] `firebase-config.js` updated with YOUR credentials
- [ ] All files committed to Git
- [ ] Pushed to GitHub
- [ ] GitHub Pages enabled
- [ ] Tested signup/login
- [ ] Created test tree
- [ ] Verified tree renders

---

## 🎯 User Journey

1. User visits your site
2. Sees demo tree with banner
3. Clicks "Start Free"
4. Signs up with email or Google
5. Lands on dashboard (empty)
6. Clicks "Create New Tree"
7. Enters tree name and privacy
8. Opens in editor
9. Edits JSON to add family members
10. Clicks "Save Changes"
11. Clicks "Preview" to see tree
12. Shares link with family!

---

## 🔄 How to Add Your Existing Tree to Firebase

Want to move your `rfamily.json` to Firebase?

1. Log in to your site
2. Create new tree (e.g., "Suătean Family")
3. Go to Editor
4. Click "Import JSON"
5. Copy-paste contents of `rfamily.json`
6. Click Import
7. Click Save

Your original tree at `index.html` still works independently!

---

## 🎨 Customization

### Easy Changes:
- Update text in HTML files (change "Ancestrio")
- Add your logo to headers
- Modify colors in `styles.css`
- Create custom landing page

### Future Features:
- Drag-and-drop visual editor
- Image upload to Firebase Storage
- Collaborative editing
- Export to PDF
- GEDCOM import/export
- Email notifications
- Family stories/notes

---

## 🐛 Troubleshooting

**"Failed to initialize Firebase"**
- Check `firebase-config.js` has your actual credentials
- Verify all values are in quotes

**"Permission denied"**  
- Check Firestore Security Rules in Firebase Console
- Verify user is logged in

**Trees not loading**
- Open browser console (F12)
- Check for error messages
- Verify tree ID in URL

**Login not working**
- Verify auth providers enabled in Firebase Console
- Check browser console for errors
- Try incognito mode

---

## 📞 Need Help?

1. Read `FIREBASE_SETUP.md` completely
2. Check Firebase Console for errors
3. Open browser DevTools (F12) → Console
4. Verify everything is deployed
5. Test in incognito mode

---

## 🌟 What You Get

A production-ready platform with:
- ✨ Beautiful, interactive family trees
- ✨ Zero hosting costs
- ✨ Unlimited users (within free tier)
- ✨ Secure authentication
- ✨ Cloud storage
- ✨ Mobile responsive
- ✨ Easy sharing
- ✨ Privacy controls

---

## 📈 Scaling

Current free tier supports:
- ~1,000 active users/day
- ~10,000 trees total
- Unlimited page views (GitHub Pages)

When you grow beyond free tier:
- Firebase scales automatically
- Pay-as-you-grow pricing
- Very affordable (~$25/mo for small apps)

---

## 🎉 You're Ready!

Everything is set up. Just need to:
1. Configure Firebase (15 min)
2. Update `firebase-config.js` (2 min)
3. Deploy to GitHub (1 min)

Then you have a **live, multi-user family tree platform!** 🚀

---

## 📄 License

Built with ❤️ for families worldwide.

---

**Questions? Check the documentation files or Firebase Console!**

Happy tree building! 🌳
