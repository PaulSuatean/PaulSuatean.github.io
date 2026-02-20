// Dashboard Logic

let currentUser = null;
let trees = [];
let treeToDelete = null;

document.addEventListener('DOMContentLoaded', async () => {
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
  
  // Initialize Firebase
  if (!initializeFirebase()) {
    window.location.href = 'auth.html';
    return;
  }

  // Check authentication
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      document.getElementById('userName').textContent = user.displayName || user.email;
      await loadTrees();
    } else {
      window.location.href = 'auth.html';
    }
  });

  // Event listeners
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('createTreeBtn').addEventListener('click', showCreateModal);
  document.getElementById('createTreeBtnEmpty')?.addEventListener('click', showCreateModal);
  document.getElementById('closeCreateModal').addEventListener('click', hideCreateModal);
  document.getElementById('cancelCreateBtn').addEventListener('click', hideCreateModal);
  document.getElementById('createTreeForm').addEventListener('submit', createTree);
  document.getElementById('closeDeleteModal').addEventListener('click', hideDeleteModal);
  document.getElementById('cancelDeleteBtn').addEventListener('click', hideDeleteModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
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

async function loadTrees() {
  const treesGrid = document.getElementById('treesGrid');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');

  loadingState.style.display = 'block';
  emptyState.style.display = 'none';
  treesGrid.innerHTML = '';

  try {
    // Simple query without orderBy - no index needed
    const snapshot = await db.collection('trees')
      .where('userId', '==', currentUser.uid)
      .get();

    trees = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort in JavaScript
    trees.sort((a, b) => {
      const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
      const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
      return dateB - dateA;
    });

    loadingState.style.display = 'none';

    if (trees.length === 0) {
      emptyState.style.display = 'block';
    } else {
      trees.forEach(tree => renderTreeCard(tree));
    }
  } catch (error) {
    console.error('Error loading trees:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    loadingState.style.display = 'none';
    
    // Show specific error message
    let errorMsg = 'Failed to load trees. ';
    if (error.code === 'permission-denied') {
      errorMsg += 'Firestore is not enabled or security rules are blocking access. Please enable Firestore in Firebase Console.';
    } else if (error.code === 'unavailable') {
      errorMsg += 'Firestore service is unavailable. It may not be enabled yet.';
    } else {
      errorMsg += error.message;
    }
    alert(errorMsg);
    
    // Show empty state so user can still create trees
    emptyState.style.display = 'block';
  }
}

function renderTreeCard(tree) {
  const treesGrid = document.getElementById('treesGrid');
  const memberCount = countMembers(tree.data || {});
  const createdDate = tree.createdAt ? new Date(tree.createdAt.toDate()).toLocaleDateString() : 'Unknown';

  const card = document.createElement('div');
  card.className = 'tree-card';
  card.innerHTML = `
    <div class="tree-card-header">
      <div>
        <h3 class="tree-card-title">${escapeHtml(tree.name)}</h3>
        <span class="privacy-badge ${tree.privacy}">${tree.privacy === 'public' ? '🌍 Public' : '🔒 Private'}</span>
      </div>
      <div class="tree-card-actions">
        <button class="icon-btn delete" data-id="${tree.id}" data-name="${escapeHtml(tree.name)}" title="Delete">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    </div>
    ${tree.description ? `<p class="tree-card-description">${escapeHtml(tree.description)}</p>` : ''}
    <div class="tree-card-meta">
      <span class="meta-item">
        <span class="material-symbols-outlined">group</span>
        ${memberCount} ${memberCount === 1 ? 'member' : 'members'}
      </span>
      <span class="meta-item">
        <span class="material-symbols-outlined">calendar_today</span>
        ${createdDate}
      </span>
    </div>
    <div class="tree-card-actions-bottom">
      <button class="btn-view" onclick="viewTree('${tree.id}')">
        <span class="material-symbols-outlined">visibility</span>
        View
      </button>
      <button class="btn-edit" onclick="editTree('${tree.id}')">
        <span class="material-symbols-outlined">edit</span>
        Edit
      </button>
    </div>
  `;

  // Attach delete handler
  card.querySelector('.icon-btn.delete').addEventListener('click', (e) => {
    showDeleteModal(e.currentTarget.dataset.id, e.currentTarget.dataset.name);
  });

  treesGrid.appendChild(card);
}

function countMembers(data) {
  if (!data || typeof data !== 'object') return 0;
  let count = 0;
  
  function traverse(node) {
    if (!node) return;
    count++; // Count this person
    if (node.spouse) count++; // Count spouse if exists
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => traverse(child));
    }
    // Handle other possible child arrays
    if (node.grandchildren && Array.isArray(node.grandchildren)) {
      node.grandchildren.forEach(child => traverse(child));
    }
  }
  
  traverse(data);
  return count;
}

function showCreateModal() {
  document.getElementById('createTreeModal').style.display = 'flex';
  document.getElementById('treeName').focus();
}

function hideCreateModal() {
  document.getElementById('createTreeModal').style.display = 'none';
  document.getElementById('createTreeForm').reset();
}

async function createTree(e) {
  e.preventDefault();
  
  const name = document.getElementById('treeName').value;
  const description = document.getElementById('treeDescription').value;
  const privacy = document.querySelector('input[name="privacy"]:checked').value;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    // Get user's name for the root person
    const displayName = currentUser && currentUser.displayName ? currentUser.displayName.trim() : '';
    const email = currentUser && currentUser.email ? currentUser.email.trim() : '';
    const rootPersonName = displayName || (email && email.includes('@') ? email.split('@')[0] : 'Family Member');

    // Create initial tree structure
    const initialData = {
      Grandparent: rootPersonName,
      image: "",
      birthday: "",
      Parent: []
    };

    const docRef = await db.collection('trees').add({
      userId: currentUser.uid,
      name: name,
      description: description,
      privacy: privacy,
      data: initialData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    hideCreateModal();
    await loadTrees();
    
    // Redirect to editor
    window.location.href = `editor.html?id=${docRef.id}`;
  } catch (error) {
    console.error('Error creating tree:', error);
    alert('Failed to create tree. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Tree';
  }
}

function showDeleteModal(treeId, treeName) {
  treeToDelete = treeId;
  document.getElementById('deleteTreeName').textContent = treeName;
  document.getElementById('deleteModal').style.display = 'flex';
}

function hideDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  treeToDelete = null;
}

async function confirmDelete() {
  if (!treeToDelete) return;

  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting...';

  try {
    await db.collection('trees').doc(treeToDelete).delete();
    hideDeleteModal();
    await loadTrees();
  } catch (error) {
    console.error('Error deleting tree:', error);
    alert('Failed to delete tree. Please try again.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete';
  }
}

async function logout() {
  try {
    await auth.signOut();
    window.location.href = 'auth.html';
  } catch (error) {
    console.error('Error signing out:', error);
    alert('Failed to sign out. Please try again.');
  }
}

function viewTree(treeId) {
  window.location.href = `tree.html?id=${treeId}`;
}

function editTree(treeId) {
  window.location.href = `editor.html?id=${treeId}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
