# 🔧 Firebase Setup Instructions for Ancestrio

Your site is deployed at **https://ancestrio.web.app**, but you need to enable Firebase services for login/signup to work.

## ✅ Quick Setup Checklist

### 1. Enable Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/project/ancestrio/authentication)
2. Click **"Get started"** (if this is your first time)
3. **Enable Email/Password Authentication:**
   - Click on **"Email/Password"** in the Sign-in providers list
   - Toggle **"Enable"** for the first option (Email/Password)
   - Click **"Save"**

4. **Enable Google Sign-In:**
   - Click on **"Google"** in the Sign-in providers list
   - Toggle **"Enable"**
   - Select a support email (your email: suatean.paul@gmail.com)
   - Click **"Save"**

### 2. Create Firestore Database

1. Go to [Firestore Database](https://console.firebase.google.com/project/ancestrio/firestore)
2. Click **"Create database"**
3. Select **"Start in production mode"**
4. Choose a location (e.g., **us-central** or **europe-west**)
5. Click **"Enable"**

### 3. Set Up Firestore Security Rules

After creating the database:

1. Click on the **"Rules"** tab in Firestore
2. Replace the default rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can read/write their own data
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Trees collection - users can manage their own trees
    match /trees/{treeId} {
      allow read: if request.auth != null && 
                     (resource.data.isPublic == true || 
                      resource.data.userId == request.auth.uid);
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && 
                               resource.data.userId == request.auth.uid;
    }
  }
}
```

3. Click **"Publish"**

## 🧪 Test Your Setup

After completing the steps above:

1. Visit **https://ancestrio.web.app**
2. Click on **"Sign Up"** tab
3. Fill in your details:
   - Full Name: Your name
   - Email: Your email
   - Password: At least 6 characters
4. Click **"Create Account"**

You should be redirected to the dashboard!

## 🔍 Troubleshooting

### "Nothing happens when I click Login"
- Make sure you've enabled Email/Password authentication in Firebase Console
- Check browser console for errors (F12 → Console tab)
- Verify you're using the Sign Up tab first (you need to create an account)

### "Sign Up tab doesn't work"
- Verify Firestore is enabled
- Check Firestore security rules are set correctly
- Make sure your email is valid and password is at least 6 characters

### "Google Sign-In doesn't work"
- Enable Google authentication provider in Firebase Console
- Make sure you selected a support email
- Try using email/password first to verify basic setup

## 📋 Quick Links

- [Firebase Console](https://console.firebase.google.com/project/ancestrio/overview)
- [Authentication Settings](https://console.firebase.google.com/project/ancestrio/authentication)
- [Firestore Database](https://console.firebase.google.com/project/ancestrio/firestore)
- [Hosting Settings](https://console.firebase.google.com/project/ancestrio/hosting)

## 🚀 After Setup

Once everything is working:

1. Create your first family tree
2. Edit your tree data
3. Share your tree URL with family members
4. Make trees public or private

Need help? Check the browser console (F12) for specific error messages!
