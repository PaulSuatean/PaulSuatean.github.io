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
      updateDashboardTitle(currentUser);
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
  document.getElementById('closeDeleteModal').addEventListener('click', hideDeleteModal);
  document.getElementById('cancelDeleteBtn').addEventListener('click', hideDeleteModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
  
  // Wizard navigation
  document.getElementById('nextStep1').addEventListener('click', () => {
    const treeName = document.getElementById('treeName').value.trim();
    const treeNameInput = document.getElementById('treeName');
    const treeNameError = document.getElementById('treeNameError');
    
    if (!treeName) {
      treeNameInput.classList.add('error');
      treeNameError.style.display = 'block';
      treeNameInput.focus();
      return;
    }
    goToStep(2);
  });
  
  // Clear error on input
  document.getElementById('treeName').addEventListener('input', () => {
    const treeNameInput = document.getElementById('treeName');
    const treeNameError = document.getElementById('treeNameError');
    if (treeNameInput.value.trim()) {
      treeNameInput.classList.remove('error');
      treeNameError.style.display = 'none';
    }
  });
  
  document.getElementById('backStep2').addEventListener('click', () => goToStep(1));
  document.getElementById('nextStep2').addEventListener('click', () => goToStep(3));
  document.getElementById('backStep3').addEventListener('click', () => goToStep(2));
  
  // Final create button in step 3
  document.getElementById('finalCreateTreeBtn').addEventListener('click', createTreeFromWizard);
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

function getCurrentUserName(user) {
  if (!user) return '';
  const displayName = user.displayName ? user.displayName.trim() : '';
  if (displayName) return displayName;
  const email = user.email ? user.email.trim() : '';
  if (!email) return '';
  return email.includes('@') ? email.split('@')[0] : email;
}

function updateDashboardTitle(user) {
  const titleEl = document.getElementById('dashboardTitle');
  if (!titleEl) return;
  const username = getCurrentUserName(user);
  titleEl.textContent = username ? `${username}'s Family Trees` : 'My Family Trees';
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
  
  // Generate preview HTML
  const previewHtml = tree.thumbnailData 
    ? `<div class="tree-card-preview"><img src="${tree.thumbnailData}" alt="Tree preview" /></div>`
    : `<div class="tree-card-preview">
         <div class="tree-card-preview-placeholder">
           <span class="material-symbols-outlined">account_tree</span>
           <span>No preview available</span>
         </div>
       </div>`;
  
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
    ${previewHtml}
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
  goToStep(1);
  document.getElementById('treeName').focus();
}

function hideCreateModal() {
  document.getElementById('createTreeModal').style.display = 'none';
  resetWizard();
}

function goToStep(step) {
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
  
  // Show selected step
  const stepEl = document.getElementById(`step${step}`);
  if (stepEl) {
    stepEl.classList.add('active');
  }
  
  // Update progress indicator
  document.querySelectorAll('.progress-step').forEach(p => {
    p.classList.remove('active');
  });
  const progressStep = document.querySelector(`.progress-step[data-step="${step}"]`);
  if (progressStep) {
    progressStep.classList.add('active');
  }
}

function resetWizard() {
  document.getElementById('treeName').value = '';
  document.getElementById('treeDescription').value = '';
  document.querySelector('input[name="privacy"][value="private"]').checked = true;
  document.querySelector('input[name="hasSpouse"][value="no"]').checked = true;
  document.getElementById('myChildren').value = '0';
  document.getElementById('siblingCount').value = '0';
  document.getElementById('generations').value = '3';
  document.getElementById('uncles').value = '1';
  document.getElementById('myGrandchildren').value = '0';
  document.getElementById('ancestorChildren').value = '3';
  document.querySelector('input[name="useTemplate"][value="yes"]').checked = true;
  
  // Clear error state
  const treeNameInput = document.getElementById('treeName');
  const treeNameError = document.getElementById('treeNameError');
  treeNameInput.classList.remove('error');
  treeNameError.style.display = 'none';
  
  goToStep(1);
}

async function createTreeFromWizard(e) {
  e.preventDefault();
  
  // Get basic info
  const name = document.getElementById('treeName').value.trim();
  const description = document.getElementById('treeDescription').value.trim();
  const privacy = document.querySelector('input[name="privacy"]:checked').value;
  
  if (!name) {
    const treeNameInput = document.getElementById('treeName');
    const treeNameError = document.getElementById('treeNameError');
    treeNameInput.classList.add('error');
    treeNameError.style.display = 'block';
    goToStep(1);
    treeNameInput.focus();
    return;
  }
  
  // Get wizard answers
  const hasSpouse = document.querySelector('input[name="hasSpouse"]:checked').value === 'yes';
  const generations = parseInt(document.getElementById('generations').value);
  const ancestorChildren = parseInt(document.getElementById('ancestorChildren').value);
  const uncles = parseInt(document.getElementById('uncles').value);
  const myChildren = parseInt(document.getElementById('myChildren').value);
  const myGrandchildren = parseInt(document.getElementById('myGrandchildren').value);
  const siblingCount = parseInt(document.getElementById('siblingCount').value);
  const useTemplate = document.querySelector('input[name="useTemplate"]:checked').value === 'yes';
  
  const createBtn = document.getElementById('finalCreateTreeBtn');
  createBtn.disabled = true;
  createBtn.textContent = 'Creating...';

  try {
    // Get user's name for the root person
    const rootPersonName = getCurrentUserName(currentUser) || 'Family Member';

    // Generate template based on answers
    let initialData;
    if (useTemplate) {
      initialData = generateFamilyTemplate({
        rootName: rootPersonName,
        hasSpouse,
        generations,
        ancestorChildren,
        uncles,
        myChildren,
        myGrandchildren,
        siblingCount
      });
    } else {
      // Simple empty template
      initialData = {
        Grandparent: rootPersonName,
        image: "",
        birthday: "",
        Parent: []
      };
    }

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
    createBtn.disabled = false;
    createBtn.textContent = 'Create Tree';
  }
}

function generateFamilyTemplate(options) {
  const {
    rootName,
    hasSpouse,
    generations,
    ancestorChildren,
    uncles,
    myChildren,
    myGrandchildren,
    siblingCount
  } = options;

  const toSafeInt = (value) => (Number.isFinite(value) ? value : 0);
  const safeGenerations = toSafeInt(generations);
  const safeAncestorChildren = Math.max(0, toSafeInt(ancestorChildren));
  const safeUncles = Math.max(0, toSafeInt(uncles));
  const safeMyChildren = Math.max(0, toSafeInt(myChildren));
  const safeMyGrandchildren = Math.max(0, toSafeInt(myGrandchildren));
  const safeSiblingCount = Math.max(0, toSafeInt(siblingCount));

  const maleFirst = ['James', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'John', 'Charles'];
  const femaleFirst = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];

  function getRandomName(gender = 'any') {
    let firstName;
    if (gender === 'male') {
      firstName = maleFirst[Math.floor(Math.random() * maleFirst.length)];
    } else if (gender === 'female') {
      firstName = femaleFirst[Math.floor(Math.random() * femaleFirst.length)];
    } else {
      firstName = Math.random() > 0.5 ? 
        maleFirst[Math.floor(Math.random() * maleFirst.length)] :
        femaleFirst[Math.floor(Math.random() * femaleFirst.length)];
    }
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
  }

  const data = {
    Grandparent: rootName,
    image: '',
    birthday: ''
  };

  // Oldest ancestor spouse (top generation in rfamily schema).
  data.spouse = hasSpouse ? {
    name: getRandomName('female'),
    image: '',
    birthday: ''
  } : null;

  const rootChild = {
    name: rootName,
    image: '',
    birthday: '',
    spouse: hasSpouse ? { name: getRandomName('female'), image: '', birthday: '' } : null,
    grandchildren: []
  };

  // Add user's children as grandchildren of the oldest ancestor.
  for (let i = 0; i < safeMyChildren; i++) {
    const child = {
      name: getRandomName(),
      image: '',
      birthday: ''
    };

    // Optionally add great-grandchildren through the first child.
    if (safeMyGrandchildren > 0 && i === 0) {
      child.grandchildren = [];
      for (let g = 0; g < Math.min(safeMyGrandchildren, 5); g++) {
        child.grandchildren.push({
          name: getRandomName(),
          image: '',
          birthday: ''
        });
      }
    }

    rootChild.grandchildren.push(child);
  }

  const totalParents = Math.max(1, Math.max(safeAncestorChildren, safeUncles + 1));

  data.Parent = [];
  if (safeGenerations >= 2) {
    for (let i = 0; i < totalParents; i++) {
      const parent = {
        name: getRandomName('male'),
        image: '',
        birthday: '',
        spouse: { name: getRandomName('female'), image: '', birthday: '' },
        children: []
      };

      if (i === 0) {
        parent.children.push(rootChild);
        for (let s = 0; s < safeSiblingCount; s++) {
          parent.children.push({
            name: getRandomName(),
            image: '',
            birthday: ''
          });
        }
      }

      data.Parent.push(parent);
    }
  }

  // Add great-grandparents for the top generation if requested.
  if (safeGenerations >= 4) {
    data.parents = {
      name: getRandomName('male'),
      image: '',
      birthday: '',
      spouse: { name: getRandomName('female'), image: '', birthday: '' }
    };
    if (data.spouse) {
      data.spouse.parents = {
        name: getRandomName('male'),
        image: '',
        birthday: '',
        spouse: { name: getRandomName('female'), image: '', birthday: '' }
      };
    }
  }

  return data;
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
