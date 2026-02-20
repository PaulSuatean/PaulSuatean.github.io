// Authentication Logic

document.addEventListener('DOMContentLoaded', () => {
  console.log('Auth page loaded');
  
  // Theme toggle
  const themeBtn = document.getElementById('themeBtn');
  const themeKey = 'tree-theme';
  const savedTheme = localStorage.getItem(themeKey);
  const initialTheme = resolveInitialTheme(savedTheme);
  document.body.classList.toggle('theme-dark', initialTheme === 'dark');
  updateThemeIcon();

  themeBtn?.addEventListener('click', () => {
    document.body.classList.toggle('theme-dark');
    const isDark = document.body.classList.contains('theme-dark');
    localStorage.setItem(themeKey, isDark ? 'dark' : 'light');
    updateThemeIcon();
  });
  
  // Get DOM elements first
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const googleSignInBtn = document.getElementById('googleSignIn');
  const errorMessage = document.getElementById('errorMessage');
  const tabButtons = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');

  console.log('DOM elements found:', { loginForm, signupForm, errorMessage });

  // Initialize Firebase
  if (!initializeFirebase()) {
    console.error('Firebase initialization failed');
    showError('Failed to initialize Firebase. Please check your configuration.');
    return;
  }
  
  console.log('Firebase initialized successfully');

  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      
      // Update active tab
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show corresponding form
      forms.forEach(form => form.classList.remove('active'));
      document.getElementById(`${tab}Form`).classList.add('active');
      
      // Clear error
      hideError();
    });
  });

  // Login with email/password
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Login form submitted');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    console.log('Attempting login with email:', email);
    
    try {
      showLoading(loginForm);
      await auth.signInWithEmailAndPassword(email, password);
      console.log('Login successful, redirecting...');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Login error:', error);
      showError(getErrorMessage(error.code));
    } finally {
      hideLoading(loginForm);
    }
  });

  // Sign up with email/password
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Signup form submitted');
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    console.log('Attempting signup with:', { name, email });
    
    try {
      showLoading(signupForm);
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      console.log('User created:', userCredential.user.uid);
      
      // Update profile with name
      await userCredential.user.updateProfile({
        displayName: name
      });
      console.log('Profile updated with name');
      
      // Create user document in Firestore
      await db.collection('users').doc(userCredential.user.uid).set({
        name: name,
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('User document created in Firestore');
      
      console.log('Signup successful, redirecting...');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Signup error:', error);
      showError(getErrorMessage(error.code));
    } finally {
      hideLoading(signupForm);
    }
  });

  // Google Sign In
  googleSignInBtn.addEventListener('click', async () => {
    console.log('Google sign-in clicked');
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      console.log('Google sign-in successful:', result.user.email);
      
      // Check if user document exists, create if not
      const userDoc = await db.collection('users').doc(result.user.uid).get();
      if (!userDoc.exists) {
        await db.collection('users').doc(result.user.uid).set({
          name: result.user.displayName,
          email: result.user.email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      window.location.href = 'dashboard.html';
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        showError(getErrorMessage(error.code));
      }
    }
  });

  // Helper functions
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
  }

  function hideError() {
    errorMessage.classList.remove('show');
  }

  function showLoading(form) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Loading...';
  }

  function hideLoading(form) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = false;
    button.textContent = form.id === 'loginForm' ? 'Login' : 'Create Account';
  }

  function getErrorMessage(code) {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/operation-not-allowed': 'Operation not allowed.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.'
    };
    return messages[code] || 'An error occurred. Please try again.';
  }
  
  console.log('All event listeners attached successfully');
});

function updateThemeIcon() {
  const themeBtn = document.getElementById('themeBtn');
  if (!themeBtn) return;
  const isDark = document.body.classList.contains('theme-dark');
  const icon = themeBtn.querySelector('.material-symbols-outlined');
  const iconName = isDark ? 'light_mode' : 'dark_mode';
  if (icon) {
    icon.textContent = iconName;
  } else {
    themeBtn.textContent = iconName;
  }
  themeBtn.classList.toggle('sun-icon', isDark);
  themeBtn.classList.toggle('moon-icon', !isDark);
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  themeBtn.setAttribute('aria-label', label);
  themeBtn.setAttribute('title', label);
  themeBtn.setAttribute('aria-pressed', String(isDark));
}

function resolveInitialTheme(saved) {
  if (saved === 'dark' || saved === 'light') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return isNightTime() ? 'dark' : 'light';
}

function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 20 || hour < 7;
}
