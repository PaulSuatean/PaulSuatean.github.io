// Editor Logic

let currentUser = null;
let currentTree = null;
let treeId = null;
let hasUnsavedChanges = false;

document.addEventListener('DOMContentLoaded', async () => {
  // Theme toggle
  const themeBtn = document.getElementById('themeBtn');
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('theme-dark');
    themeBtn.querySelector('.material-symbols-outlined').textContent = 'dark_mode';
  }
  
  themeBtn?.addEventListener('click', () => {
    document.body.classList.toggle('theme-dark');
    const isDark = document.body.classList.contains('theme-dark');
    themeBtn.querySelector('.material-symbols-outlined').textContent = isDark ? 'dark_mode' : 'light_mode';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
  
  // Initialize Firebase
  if (!initializeFirebase()) {
    window.location.href = 'auth.html';
    return;
  }

  // Get tree ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  treeId = urlParams.get('id');
  if (!treeId) {
    alert('No tree ID provided');
    window.location.href = 'dashboard.html';
    return;
  }

  // Check authentication
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      await loadTree();
    } else {
      window.location.href = 'auth.html';
    }
  });

  // Event listeners
  document.getElementById('saveBtn').addEventListener('click', saveTree);
  document.getElementById('viewTreeBtn').addEventListener('click', () => {
    window.open(`tree.html?id=${treeId}`, '_blank');
  });
  
  // Sidebar actions
  document.getElementById('addPersonBtn').addEventListener('click', addFamilyMember);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
  document.getElementById('importJsonBtn').addEventListener('click', showImportModal);
  
  // Tabs
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // JSON toolbar
  document.getElementById('formatJsonBtn').addEventListener('click', formatJson);
  document.getElementById('validateJsonBtn').addEventListener('click', validateJson);
  
  // JSON editor - track changes
  const jsonEditor = document.getElementById('jsonEditor');
  jsonEditor.addEventListener('input', () => {
    markAsChanged();
  });
  
  // Tree settings - track changes
  document.getElementById('editTreeName').addEventListener('input', markAsChanged);
  document.getElementById('editTreeDescription').addEventListener('input', markAsChanged);
  document.getElementById('editTreePrivacy').addEventListener('change', markAsChanged);
  
  // Import modal
  document.getElementById('closeImportModal').addEventListener('click', hideImportModal);
  document.getElementById('cancelImportBtn').addEventListener('click', hideImportModal);
  document.getElementById('confirmImportBtn').addEventListener('click', importJson);
  document.getElementById('fileInput').addEventListener('change', handleFileSelect);
  
  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
});

async function loadTree() {
  try {
    const doc = await db.collection('trees').doc(treeId).get();
    
    if (!doc.exists) {
      alert('Tree not found');
      window.location.href = 'dashboard.html';
      return;
    }
    
    currentTree = { id: doc.id, ...doc.data() };
    
    // Check ownership
    if (currentTree.userId !== currentUser.uid) {
      alert('You do not have permission to edit this tree');
      window.location.href = 'dashboard.html';
      return;
    }
    
    // Populate UI
    document.getElementById('treeTitle').textContent = currentTree.name;
    document.getElementById('editTreeName').value = currentTree.name || '';
    document.getElementById('editTreeDescription').value = currentTree.description || '';
    document.getElementById('editTreePrivacy').value = currentTree.privacy || 'private';
    
    // Load JSON editor
    const jsonEditor = document.getElementById('jsonEditor');
    jsonEditor.value = JSON.stringify(currentTree.data || {}, null, 2);
    
    hasUnsavedChanges = false;
    updateSaveButton();
  } catch (error) {
    console.error('Error loading tree:', error);
    alert('Failed to load tree. Please try again.');
  }
}

function markAsChanged() {
  hasUnsavedChanges = true;
  updateSaveButton();
}

function updateSaveButton() {
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = !hasUnsavedChanges;
  saveBtn.querySelector('span').nextSibling.textContent = hasUnsavedChanges ? ' Save Changes *' : ' Save Changes';
}

async function saveTree() {
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Saving...';
  
  try {
    // Validate JSON
    const jsonText = document.getElementById('jsonEditor').value;
    let treeData;
    try {
      treeData = JSON.parse(jsonText);
    } catch (e) {
      alert('Invalid JSON format. Please fix errors before saving.');
      return;
    }
    
    // Get updated values
    const name = document.getElementById('editTreeName').value.trim();
    const description = document.getElementById('editTreeDescription').value.trim();
    const privacy = document.getElementById('editTreePrivacy').value;
    
    if (!name) {
      alert('Tree name is required');
      return;
    }
    
    // Save to Firestore
    await db.collection('trees').doc(treeId).update({
      name: name,
      description: description,
      privacy: privacy,
      data: treeData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    currentTree.name = name;
    currentTree.description = description;
    currentTree.privacy = privacy;
    currentTree.data = treeData;
    
    document.getElementById('treeTitle').textContent = name;
    
    hasUnsavedChanges = false;
    updateSaveButton();
    
    // Show success message temporarily
    saveBtn.textContent = '✓ Sa      } else if (relation === 'child') {
        if (meta.targetType === 'child') {
          const parent = getRFamilyParent(treeData, meta.parentIndex);
          if (!parent) return;
          if (!Array.isArray(parent.children)) parent.children = [];
          parent.children.push(newMember);
        } else if (meta.targetType === 'grandchild') {
          const child = getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
          if (!child) return;
          if (!Array.isArray(child.grandchildren)) child.grandchildren = [];
          child.grandchildren.push(newMember);
        }
ved!';
    setTimeout(() => {
      saveBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error('Error saving tree:', error);
    alert('Failed to save tree. Please try again.');
  } finally {
    updateSaveButton();
  }
}

function switchTab(tabName) {
  // Update tabs
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  if (tabName === 'visual') {
    document.getElementById('visualTab').classList.add('active');
  } else if (tabName === 'json') {
    document.getElementById('jsonTab').classList.add('active');
  }
}

function formatJson() {
  const jsonEditor = document.getElementById('jsonEditor');
  try {
    const parsed = JSON.parse(jsonEditor.value);
    jsonEditor.value = JSON.stringify(parsed, null, 2);
    showJsonStatus('Formatted successfully', 'valid');
  } catch (e) {
    showJsonStatus('Invalid JSON - cannot format', 'invalid');
  }
}

function validateJson() {
  const jsonEditor = document.getElementById('jsonEditor');
  try {
    JSON.parse(jsonEditor.value);
    showJsonStatus('Valid JSON ✓', 'valid');
  } catch (e) {
    showJsonStatus('Invalid JSON: ' + e.message, 'invalid');
  }
}

function showJsonStatus(message, type) {
  const status = document.getElementById('jsonStatus');
  status.textContent = message;
  status.className = 'json-status ' + type;
  
  setTimeout(() => {
    status.textContent = '';
    status.className = 'json-status';
  }, 5000);
}

function exportJson() {
  const jsonText = document.getElementById('jsonEditor').value;
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentTree.name.replace(/[^a-z0-9]/gi, '_')}_family_tree.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokfunction wrapRFamilyNodeWithParents(node, parentsData, targetMeta) {
  if (!parentsData || typeof parentsData !== 'object') return node;
  const parentSpouses = extractSpouses(parentsData.spouse);
  return {
    id: `ancestor-${node.id}`,
    label: formatCoupleLabel(parentsData.name, null) || 'Parent',
    image: parentsData.image || '',
    spouses: parentSpouses,
    meta: {
      type: 'ancestor',
      targetType: targetMeta.type,
      parentIndex: targetMeta.parentIndex,
      childIndex: targetMeta.childIndex,
      grandIndex: targetMeta.grandIndex
    },
    children: [node]
  };
}

eObjectURL(url);
}

function showImportModal() {
  document.getElementById('importModal').style.display = 'flex';
}

function hideImportModal() {
  document.getElementById('importModal').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('pasteJson').value = '';
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('pasteJson').value = e.target.result;
    };
    reader.readAsText(file);
  }
}

function importJson() {
  const jsonText = document.getElementById('pasteJson').value.trim();
  
  if (!jsonText) {
    alert('Please select a file or paste JSON data');
    return;
  }
  
  try {
    const parsed = JSON.parse(jsonText);
    document.getElementById('jsonEditor').value = JSON.stringify(parsed, null, 2);
    markAsChanged();
    hideImportModal();
    switchTab('json');
  } catch (e) {
    alert('Invalid JSON format: ' + e.message);
  }
}

function addFamilyMember() {
  const name = prompt('Enter the name of the new family member:');
  
  if (!function getRFamilyGrandchild(treeData, parentIndex, childIndex, grandIndex) {
  const child = getRFamilyChild(treeData, parentIndex, childIndex);
  if (!child || !Array.isArray(child.grandchildren)) return null;
  return child.grandchildren[grandIndex] || null;
}

function getRFamilyTargetNode(treeData, meta) {
  const targetType = meta.type === 'ancestor' ? meta.targetType : meta.type;
  if (targetType === 'root') return treeData;
  if (targetType === 'parent') return getRFamilyParent(treeData, meta.parentIndex);
  if (targetType === 'child') return getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
  if (targetType === 'grandchild') {
    return getRFamilyGrandchild(treeData, meta.parentIndex, meta.childIndex, meta.grandIndex);
  }
  return null;
}

function getRFamilyParentsData(treeData, meta, createIfMissing) {
  let targetMeta = meta;
  if (meta && meta.type === 'spouse' && meta.parentType === 'ancestor') {
    targetMeta = {
      type: 'ancestor',
      targetType: meta.targetType,
      parentIndex: meta.parentIndex,
      childIndex: meta.childIndex,
      grandIndex: meta.grandIndex
    };
  }
  const target = getRFamilyTargetNode(treeData, targetMeta);
  if (!target) return null;
  if (!target.parents || typeof target.parents !== 'object') {
    if (!createIfMissing) return null;
    target.parents = { name: '', image: '', birthday: '' };
  }
  return target.parents;
}

name || !name.trim()) {
    return; // User cancelled or entered empty name
  }
  
  const jsonEditor = document.getElementById('jsonEditor');
  
  try {
    const treeData = JSON.parse(jsonEditor.value);
    
    // Create a new person template
    const newPerson = {
      name: name.trim(),
      image: "",
      birthday: ""
    };
    
    // Add to the Parent array (siblings of the main family line)
    if (!treeData.Parent) {
      treeData.Parent = [];
    }
    
    // If Parent is not an array, convert it
    if (!Array.isArray(treeData.Parent)) {
      treeData.Parent = [treeData.Parent];
    }
    
    treeData.Parent.push(newPerson);
    
    // Update the JSON editor
    jsonEditor.value = JSON.stringify(treeData, null, 2);
    
    // Mark as changed and switch to JSON tab
    markAsChanged();
    switchTab('json');
    
    // Show success message
    showJsonStatus(`Added "${name}" to the family tree. Edit details in the JSON below.`, 'valid');
    
    // Scroll to bottom of JSON editor to show the new entry
    setTimeout(() => {
      jsonEditor.scrollTop = jsonEditor.scrollHeight;
    }, 100);
    
  } catch (e) {
    alert('Error adding family member. Please check your JSON format.\n\nError: ' + e.message);
  }
}
