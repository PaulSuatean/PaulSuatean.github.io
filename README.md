# Ancestrio Family Tree App

This repository is a static frontend app for building and viewing family trees, with Firebase for auth and data.

## Project layout

```
.
|- index.html                 # landing/home page
|- pages/                     # app pages (auth, dashboard, editor, tree, contact, demo)
|- scripts/                   # JavaScript modules
|- styles/                    # shared and page-specific CSS
|- images/                    # person photos and static assets
|- data/                      # local demo data
|- docs/                      # setup and implementation documentation
|- firebase.json              # Firebase hosting + Firestore config
|- firestore.rules            # Firestore security rules
|- firestore.indexes.json     # Firestore indexes
```

## Documentation

- `docs/QUICK_START.md`: fastest setup path
- `docs/FIREBASE_SETUP.md`: Firebase setup details
- `docs/LOCAL_TESTING.md`: local emulator/dev flow
- `docs/WIZARD_SETUP.md`: dashboard wizard notes
- `docs/IMPLEMENTATION_SUMMARY.md`: architecture and feature summary

## Single source of truth for Firebase config

Use only the root files:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`

## Entry points

- Public home: `index.html`
- App auth: `pages/auth.html`
- Dashboard: `pages/dashboard.html`
- Editor: `pages/editor.html`
- Viewer: `pages/tree.html`
