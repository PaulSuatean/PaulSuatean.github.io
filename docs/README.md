# Ancestrio Docs

This folder contains setup and operational docs for the Family Tree app.

## Current app routes

- `index.html`: public landing page
- `pages/auth.html`: sign in and account creation
- `pages/dashboard.html`: tree management
- `pages/editor.html`: tree editing
- `pages/tree.html`: tree viewer
- `pages/demo-tree.html`: sample tree experience
- `pages/contact.html`: contact page

## Current project layout

- `scripts/`: JavaScript logic and bootstrapping
- `styles/`: shared and page-scoped CSS
- `images/`: profile images and static assets
- `data/`: local sample data (`data/rfamily.json`)
- `firebase.json`: Firebase hosting and Firestore config
- `firestore.rules`: Firestore security rules
- `firestore.indexes.json`: Firestore indexes

## Setup order

1. Read `FIREBASE_SETUP.md`.
2. Update `scripts/firebase-config.js` with your Firebase project values.
3. Follow `QUICK_START.md` to validate auth, dashboard, editor, and viewer flows.
4. Use `LOCAL_TESTING.md` if you want emulator-based local development.

## Additional docs

- `FIREBASE_SETUP.md`: Firebase project setup and deployment details
- `QUICK_START.md`: concise checklist for first run
- `LOCAL_TESTING.md`: Firebase emulator/local host flow
- `SETUP_INSTRUCTIONS.md`: broader environment and setup notes
- `IMPLEMENTATION_SUMMARY.md`: architecture and feature notes
- `WIZARD_SETUP.md`: dashboard wizard behavior and implementation notes
