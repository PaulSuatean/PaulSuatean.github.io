// Firebase Configuration
// Replace these values with your actual Firebase project credentials
// Get these from Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration

const firebaseConfig = {
  apiKey: "AIzaSyBSRnThWQY70hht4RGFKi2VnrGxBUDeWw4",
  authDomain: "ancestrio.firebaseapp.com",
  projectId: "ancestrio",
  storageBucket: "ancestrio.firebasestorage.app",
  messagingSenderId: "1029073457660",
  appId: "1:1029073457660:web:6c2a2ad532e96ba4bee279"
};

// Initialize Firebase (will be used by other scripts)
let app, auth, db, storage;

// Check if running locally
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// Set to true to use emulator, false to use production
const useEmulator = false; // BYPASS: Set to false for production Firebase testing
const isDevelopment = isLocalhost && useEmulator;

function initializeFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded - script tag missing or blocked');
    alert('Firebase SDK failed to load. Please check your internet connection and disable any ad blockers.');
    return false;
  }
  
  try {
    console.log('Environment:', isDevelopment ? 'LOCAL EMULATOR' : 'PRODUCTION');
    console.log('Initializing Firebase with config:', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      environment: isDevelopment ? 'emulator' : 'production'
    });
    
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    
    // Connect to emulators if running locally
    if (isDevelopment) {
      console.log('Connecting to Firebase Emulators...');
      
      // Disable SSL error bypass for emulator
      auth.settings.appVerificationDisabledForTesting = true;
      
      try {
        // Connect to Auth Emulator (use 127.0.0.1 for consistency)
        auth.useEmulator('http://127.0.0.1:9099');
        console.log('✓ Connected to Auth Emulator on port 9099');
      } catch (e) {
        console.error('Auth emulator connection failed:', e.message);
      }
      
      try {
        // Connect to Firestore Emulator
        db.useEmulator('127.0.0.1', 8080);
        console.log('✓ Connected to Firestore Emulator on port 8080');
      } catch (e) {
        console.error('Firestore emulator connection failed:', e.message);
      }
      
      try {
        // Connect to Storage Emulator
        if (firebase.storage) {
          firebase.storage().useEmulator('127.0.0.1', 5001);
          console.log('✓ Connected to Storage Emulator on port 5001');
        }
      } catch (e) {
        console.warn('Storage emulator connection:', e.message);
      }
      
      console.log('📍 All emulator connections attempted');
    }
    
    // Only initialize storage if the SDK is loaded
    if (firebase.storage) {
      storage = firebase.storage();
    }
    console.log('Firebase initialized successfully');
    console.log('Auth:', auth);
    console.log('Firestore:', db);
    return true;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    alert('Firebase initialization failed: ' + error.message);
    return false;
  }
}
