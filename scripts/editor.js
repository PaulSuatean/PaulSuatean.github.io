// Editor Logic

let currentUser = null;
let currentTree = null;
let treeId = null;
let hasUnsavedChanges = false;
let activeSavePromise = null;
let visualState = {
  initialized: false,
  svg: null,
  g: null,
  zoom: null,
  hasUserTransform: false,
  pendingRender: null,
  autoSeeded: false
};

// Add member state
let pendingAddMemberMeta = null;
let pendingAddRelation = null;
let pendingEditMeta = null;
let pendingDeleteMeta = null;
let visitedCountries = [];
let memberModalMode = 'add';
let memberPhotoValue = '';
const LOCAL_PREVIEW_PREFIX = 'ancestrio-preview:';
const LOCAL_PREVIEW_MAX_AGE_MS = 6 * 60 * 60 * 1000;

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
  document.getElementById('viewTreeBtn').addEventListener('click', openPreview);
  
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
    scheduleVisualRender(false);
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

  // Delete confirmation modal
  document.getElementById('closeDeleteModal').addEventListener('click', hideDeleteConfirmModal);
  document.getElementById('cancelDeleteBtn').addEventListener('click', hideDeleteConfirmModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', performDelete);
  
  // Close delete modal on backdrop click
  document.getElementById('deleteConfirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'deleteConfirmModal') {
      hideDeleteConfirmModal();
    }
  });

  // Add Member popup and modal
  initAddMemberUI();

  initVisualEditor();
  scheduleVisualRender(true);
  
  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
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
    
    const seededData = ensureDefaultTreeData(currentTree.data);
    const didSeed = seededData !== currentTree.data;
    if (didSeed) {
      currentTree.data = seededData;
    }

    const jsonEditor = document.getElementById('jsonEditor');
    jsonEditor.value = JSON.stringify(currentTree.data || {}, null, 2);
    visualState.autoSeeded = false;

    scheduleVisualRender(true);
    
    hasUnsavedChanges = didSeed;
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
  const span = saveBtn.querySelector('span');
  if (span && span.nextSibling) {
    span.nextSibling.textContent = hasUnsavedChanges ? ' Save Changes *' : ' Save Changes';
  }
}

async function generateTreeThumbnail() {
  try {
    if (!visualState.svg || !visualState.g) {
      console.log('Visual editor not initialized, skipping thumbnail generation');
      return null;
    }
    
    // Get the SVG element
    const svgNode = visualState.svg.node();
    if (!svgNode) return null;
    
    // Get the bounding box of all content
    const bbox = visualState.g.node().getBBox();
    if (!bbox || bbox.width === 0 || bbox.height === 0) {
      console.log('Empty tree, skipping thumbnail');
      return null;
    }
    
    // Fixed thumbnail dimensions
    const thumbnailWidth = 800;
    const thumbnailHeight = 600;
    
    // Add padding around the tree content
    const padding = 100;
    const contentWidth = bbox.width + padding * 2;
    const contentHeight = bbox.height + padding * 2;
    
    // Calculate scale to fit the tree in the thumbnail while maintaining aspect ratio
    const scaleX = thumbnailWidth / contentWidth;
    const scaleY = thumbnailHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, max 1:1
    
    // Calculate centered position
    const scaledWidth = bbox.width * scale;
    const scaledHeight = bbox.height * scale;
    const offsetX = (thumbnailWidth - scaledWidth) / 2 - bbox.x * scale;
    const offsetY = (thumbnailHeight - scaledHeight) / 2 - bbox.y * scale;
    
    // Clone and prepare SVG
    const clonedSvg = svgNode.cloneNode(true);
    clonedSvg.setAttribute('width', thumbnailWidth.toString());
    clonedSvg.setAttribute('height', thumbnailHeight.toString());
    clonedSvg.setAttribute('viewBox', `0 0 ${thumbnailWidth} ${thumbnailHeight}`);
    
    // Find the g element in the clone and apply centering transform
    const clonedG = clonedSvg.querySelector('g');
    if (clonedG) {
      clonedG.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`);
    }
    
    // Get computed styles and inline them
    const styleSheets = Array.from(document.styleSheets);
    let cssText = '';
    styleSheets.forEach(sheet => {
      try {
        if (sheet.cssRules) {
          Array.from(sheet.cssRules).forEach(rule => {
            cssText += rule.cssText + '\n';
          });
        }
      } catch (e) {
        // Cross-origin stylesheets may throw errors
        console.log('Could not access stylesheet:', e);
      }
    });
    
    // Add a style element to the cloned SVG
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = cssText;
    clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);
    
    // Serialize the SVG
    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    
    // Convert to PNG using canvas
    return new Promise((resolve) => {
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = thumbnailWidth;
        canvas.height = thumbnailHeight;
        const ctx = canvas.getContext('2d');
        
        // Fill background with button blue
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the image
        ctx.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        }, 'image/png', 0.9);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.error('Failed to load SVG image');
        resolve(null);
      };
      
      img.src = url;
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}

async function saveTree() {
  if (activeSavePromise) {
    return activeSavePromise;
  }

  activeSavePromise = (async () => {
    const saveBtn = document.getElementById('saveBtn');
    const viewTreeBtn = document.getElementById('viewTreeBtn');
    saveBtn.disabled = true;
    if (viewTreeBtn) viewTreeBtn.disabled = true;

    const span = saveBtn.querySelector('span');
    const textNode = span ? span.nextSibling : saveBtn.firstChild;
    const originalText = textNode ? textNode.textContent : saveBtn.textContent;

    if (textNode) {
      textNode.textContent = ' Saving...';
    } else {
      saveBtn.textContent = 'Saving...';
    }

    try {
      // Validate JSON
      const jsonText = document.getElementById('jsonEditor').value;
      let treeData;
      try {
        treeData = JSON.parse(jsonText);
      } catch (e) {
        alert('Invalid JSON format. Please fix errors before saving.');
        return false;
      }

      // Clean up any duplicate nodes before saving
      treeData = cleanupTreeData(treeData);

      // Get updated values
      const name = document.getElementById('editTreeName').value.trim();
      const description = document.getElementById('editTreeDescription').value.trim();
      const privacy = document.getElementById('editTreePrivacy').value;

      if (!name) {
        alert('Tree name is required');
        return false;
      }

      // Generate thumbnail as base64
      let thumbnailData = null;
      try {
        // Ensure visual editor is initialized
        if (!visualState.initialized) {
          initVisualEditor();
          // Wait a bit for initialization
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Always generate a new thumbnail on save
        if (visualState.initialized) {
          // Update the JSON editor with latest data
          const jsonEditor = document.getElementById('jsonEditor');
          jsonEditor.value = JSON.stringify(treeData, null, 2);

          // Force a synchronous render to update the visualization
          renderVisualEditor(true);

          // Wait for render to complete and DOM to update
          await new Promise(resolve => setTimeout(resolve, 150));

          // Now generate the thumbnail from the centered, rendered view
          const thumbnailBlob = await generateTreeThumbnail();
          if (thumbnailBlob) {
            // Convert blob to base64
            thumbnailData = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(thumbnailBlob);
            });
            console.log('Thumbnail generated successfully');
          } else {
            console.log('No thumbnail blob generated - tree may be empty');
          }
        }
      } catch (thumbnailError) {
        console.error('Error generating thumbnail:', thumbnailError);
        // Continue saving even if thumbnail fails
      }

      // Save to Firestore
      const updateData = {
        name: name,
        description: description,
        privacy: privacy,
        data: treeData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Only update thumbnailData if we have a new one
      if (thumbnailData) {
        updateData.thumbnailData = thumbnailData;
      }

      await db.collection('trees').doc(treeId).update(updateData);

      currentTree.name = name;
      currentTree.description = description;
      currentTree.privacy = privacy;
      currentTree.data = treeData;
      if (thumbnailData) {
        currentTree.thumbnailData = thumbnailData;
      }

      // Update JSON editor to reflect cleaned data
      const jsonEditor = document.getElementById('jsonEditor');
      jsonEditor.value = JSON.stringify(treeData, null, 2);

      document.getElementById('treeTitle').textContent = name;

      hasUnsavedChanges = false;
      updateSaveButton();

      // Show success message temporarily
      if (textNode) {
        textNode.textContent = ' Saved!';
        setTimeout(() => {
          textNode.textContent = originalText;
        }, 2000);
      } else {
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveBtn.textContent = originalText;
        }, 2000);
      }

      return true;
    } catch (error) {
      console.error('Error saving tree:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      alert('Failed to save tree: ' + (error.message || 'Please try again.'));
      return false;
    } finally {
      updateSaveButton();
      if (viewTreeBtn) viewTreeBtn.disabled = false;
    }
  })();

  try {
    return await activeSavePromise;
  } finally {
    activeSavePromise = null;
  }
}

async function openPreview() {
  const viewTreeBtn = document.getElementById('viewTreeBtn');
  if (viewTreeBtn) viewTreeBtn.disabled = true;

  try {
    if (activeSavePromise) {
      await activeSavePromise;
    }

    const draft = buildLocalPreviewDraft();
    if (!draft) return;

    let previewKey = '';
    try {
      previewKey = storeLocalPreviewDraft(draft);
    } catch (error) {
      console.error('Failed to store local preview draft:', error);
      alert('Could not open preview locally. Please try again.');
      return;
    }

    const query = new URLSearchParams();
    if (treeId) query.set('id', treeId);
    query.set('previewKey', previewKey);
    window.open(`tree.html?${query.toString()}`, '_blank', 'noopener');
  } finally {
    if (viewTreeBtn) viewTreeBtn.disabled = false;
  }
}

function buildLocalPreviewDraft() {
  const jsonEditor = document.getElementById('jsonEditor');
  if (!jsonEditor) return null;

  let treeData;
  try {
    treeData = JSON.parse(jsonEditor.value || '{}');
  } catch (e) {
    alert('Invalid JSON format. Please fix errors before preview.');
    return null;
  }

  const name = document.getElementById('editTreeName')?.value.trim() || currentTree?.name || 'Family Tree';
  const description = document.getElementById('editTreeDescription')?.value.trim() || currentTree?.description || '';
  const privacy = document.getElementById('editTreePrivacy')?.value || currentTree?.privacy || 'private';

  return {
    treeId: treeId || '',
    name,
    description,
    privacy,
    data: cleanupTreeData(treeData),
    createdAt: Date.now()
  };
}

function storeLocalPreviewDraft(draft) {
  cleanupLocalPreviewDrafts();
  const idPart = treeId || 'tree';
  const nonce = Math.random().toString(36).slice(2, 10);
  const key = `${LOCAL_PREVIEW_PREFIX}${idPart}:${Date.now()}:${nonce}`;
  localStorage.setItem(key, JSON.stringify(draft));
  return key;
}

function cleanupLocalPreviewDrafts() {
  const now = Date.now();
  const keysToDelete = [];

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(LOCAL_PREVIEW_PREFIX)) continue;

    const raw = localStorage.getItem(key);
    if (!raw) {
      keysToDelete.push(key);
      continue;
    }

    try {
      const payload = JSON.parse(raw);
      const createdAt = Number(payload && payload.createdAt);
      if (!Number.isFinite(createdAt) || now - createdAt > LOCAL_PREVIEW_MAX_AGE_MS) {
        keysToDelete.push(key);
      }
    } catch (_) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => localStorage.removeItem(key));
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
    scheduleVisualRender(true);
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
    scheduleVisualRender(false);
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
  URL.revokeObjectURL(url);
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
    scheduleVisualRender(true);
  } catch (e) {
    alert('Invalid JSON format: ' + e.message);
  }
}

function addFamilyMember() {
  // From sidebar - show popup at button position
  const btn = document.getElementById('addPersonBtn');
  const rect = btn.getBoundingClientRect();
  pendingAddMemberMeta = { type: 'root' };
  showAddMemberPopup({ clientX: rect.right + 10, clientY: rect.top }, pendingAddMemberMeta);
}

function initVisualEditor() {
  if (visualState.initialized) return;
  const svgEl = document.getElementById('visualTree');
  if (!svgEl || typeof d3 === 'undefined') return;
  visualState.svg = d3.select(svgEl);
  visualState.g = visualState.svg.append('g').attr('class', 'visual-tree-layer');
  visualState.zoom = d3.zoom()
    .scaleExtent([0.2, 2.5])
    .on('zoom', (event) => {
      visualState.g.attr('transform', event.transform);
      visualState.hasUserTransform = true;
      // Hide popup when panning/zooming
      hideAddMemberPopup();
    });
  visualState.svg.call(visualState.zoom);
  visualState.initialized = true;

  document.getElementById('visualZoomIn')?.addEventListener('click', () => adjustVisualZoom(1.2));
  document.getElementById('visualZoomOut')?.addEventListener('click', () => adjustVisualZoom(1 / 1.2));
  document.getElementById('visualReset')?.addEventListener('click', () => resetVisualView(true));

  window.addEventListener('resize', () => scheduleVisualRender(false));
}

function adjustVisualZoom(factor) {
  if (!visualState.svg || !visualState.zoom) return;
  visualState.svg.transition().duration(200).call(visualState.zoom.scaleBy, factor);
}

function resetVisualView(forceReset) {
  if (!visualState.svg || !visualState.zoom) return;
  if (forceReset) {
    visualState.hasUserTransform = false;
  }
  scheduleVisualRender(true);
}

function restructureForOrigin(data) {
  // Find the origin node (marked with isOrigin: true)
  function findOrigin(node) {
    if (node && node.isOrigin) return node;
    if (node && Array.isArray(node.children)) {
      for (let child of node.children) {
        const found = findOrigin(child);
        if (found) return found;
      }
    }
    return null;
  }

  const originNode = findOrigin(data);
  if (!originNode) return data; // No origin found, return as-is

  // Find parent of origin node
  function findNodeAndParent(current, target, parent = null) {
    if (current === target) return { node: current, parent };
    if (current && Array.isArray(current.children)) {
      for (let child of current.children) {
        const result = findNodeAndParent(child, target, current);
        if (result) return result;
      }
    }
    return null;
  }

  const result = findNodeAndParent(data, originNode);
  if (!result || !result.parent) return data; // Origin is root, return as-is

  // Extract the origin and restructure
  const newRoot = {
    name: originNode.name,
    image: originNode.image,
    birthday: originNode.birthday,
    spouse: originNode.spouse,
    spouseImage: originNode.spouseImage,
    spouseBirthday: originNode.spouseBirthday,
    tags: originNode.tags,
    spouseTags: originNode.spouseTags,
    children: originNode.children || []
  };

  // Deep clone the parent and remove the origin node from its children
  const parentCopy = JSON.parse(JSON.stringify(result.parent));
  if (Array.isArray(parentCopy.children)) {
    parentCopy.children = parentCopy.children.filter(child => child !== originNode);
  }

  // Store the parent hierarchy as "parents" property
  newRoot.parents = parentCopy;

  return newRoot;
}

function scheduleVisualRender(resetTransform) {
  if (!visualState.initialized) return;
  if (visualState.pendingRender) {
    clearTimeout(visualState.pendingRender);
  }
  visualState.pendingRender = setTimeout(() => {
    renderVisualEditor(!!resetTransform);
  }, 80);
}

function renderVisualEditor(resetTransform) {
  if (!visualState.initialized) {
    console.log('Visual state not initialized');
    return;
  }
  const jsonEditor = document.getElementById('jsonEditor');
  if (!jsonEditor) return;
  let data;
  try {
    data = JSON.parse(jsonEditor.value || '{}');
  } catch (e) {
    console.log('JSON parse error:', e);
    visualState.g.selectAll('*').remove();
    return;
  }

  console.log('Parsed tree data:', data);
  let treeData = buildVisualTreeData(data);
  console.log('Built visual tree data:', treeData);
  if (!treeData) {
    if (!visualState.autoSeeded) {
      const seeded = ensureDefaultTreeData(data);
      jsonEditor.value = JSON.stringify(seeded, null, 2);
      markAsChanged();
      visualState.autoSeeded = true;
      scheduleVisualRender(true);
      return;
    }
    visualState.g.selectAll('*').remove();
    return;
  }

  // Restructure data so origin node is at root with parents as overlay
  treeData = restructureForOrigin(treeData);

  // Match demo-tree dimensions
  const person = { width: 170, height: 120, spouseGap: 48 };
  const avatar = { r: 36, top: 10 };
  const spacing = { y: 180 };
  const nodeSize = { width: person.width, height: person.height };
  const baseCoupleWidth = person.width * 2 + person.spouseGap;
  const minHorizontalGap = Math.max(16, person.width * 0.35);
  const getRenderableSpouseEntries = (nodeData) => {
    const spouses = nodeData && Array.isArray(nodeData.spouses) ? nodeData.spouses : [];
    const entries = [];
    spouses.forEach((spouse, sourceIndex) => {
      const label = safeText((spouse && typeof spouse === 'object') ? spouse.name : spouse);
      if (!label) return;
      entries.push({
        spouse,
        sourceIndex,
        renderIndex: entries.length,
        label
      });
    });
    return entries;
  };
  const nodeGroupWidth = (treeNode) => {
    const visibleSpouses = treeNode && treeNode.data
      ? getRenderableSpouseEntries(treeNode.data)
      : [];
    const count = 1 + visibleSpouses.length;
    return person.width * count + person.spouseGap * (count - 1);
  };
  const layout = d3.tree()
    .nodeSize([baseCoupleWidth, nodeSize.height + spacing.y])
    .separation((a, b) => {
      const needed = (nodeGroupWidth(a) / 2) + minHorizontalGap + (nodeGroupWidth(b) / 2);
      const base = needed / baseCoupleWidth;
      return a.parent === b.parent ? base : base * 1.4;
    });
  const root = d3.hierarchy(treeData);
  layout(root);

  const nodes = root.descendants();

  const spouseNodes = [];
  const spouseByPrimaryId = new Map();
  const spouseEntriesByPrimaryId = new Map();
  nodes.forEach((node) => {
    spouseEntriesByPrimaryId.set(node.data.id, getRenderableSpouseEntries(node.data));
  });
  const getSpouseSideCounts = (spouseCount) => {
    const rightCount = spouseCount > 0 ? 1 : 0;
    const leftCount = Math.max(0, spouseCount - rightCount);
    return { leftCount, rightCount, totalCount: 1 + leftCount + rightCount };
  };
  const getCoupleGroupWidth = (spouseCount) => {
    const sideCounts = getSpouseSideCounts(spouseCount);
    return person.width * sideCounts.totalCount + person.spouseGap * (sideCounts.totalCount - 1);
  };
  const getPrimaryCenterForNode = (node, spouseCount) => {
    const sideCounts = getSpouseSideCounts(spouseCount);
    const groupWidth = getCoupleGroupWidth(spouseCount);
    const leftStart = node.x - groupWidth / 2;
    return leftStart + sideCounts.leftCount * (person.width + person.spouseGap) + person.width / 2;
  };
  const getSpouseCenterFromPrimary = (primaryCenterX, spouseIndex) => {
    if (spouseIndex === 0) {
      return primaryCenterX + (person.width + person.spouseGap);
    }
    // Additional spouses are shown to the left of the primary (2nd spouse, 3rd spouse, ...).
    return primaryCenterX - (person.width + person.spouseGap) * spouseIndex;
  };
  const getRenderableSpouseCount = (treeNode) => {
    if (!treeNode || !treeNode.data) return 0;
    return getRenderableSpouseEntries(treeNode.data).length;
  };
  const shiftSubtreeX = (treeNode, deltaX) => {
    if (!treeNode || !Number.isFinite(deltaX) || Math.abs(deltaX) < 0.001) return;
    treeNode.each((descendant) => {
      descendant.x += deltaX;
    });
  };
  const getChildSpouseSourceIndexForAlign = (childNode) => {
    const rawIndex = Number(childNode && childNode.data ? childNode.data.fromSpouseIndex : undefined);
    const fallback = (childNode && childNode.data && childNode.data.fromPrevSpouse) ? 1 : 0;
    const candidate = Number.isFinite(rawIndex) ? Math.trunc(rawIndex) : fallback;
    return Math.max(0, candidate);
  };
  const resolveRenderSpouseIndex = (spouseEntries, sourceIndex) => {
    if (!Array.isArray(spouseEntries) || spouseEntries.length === 0) return 0;
    const direct = spouseEntries.find((entry) => entry.sourceIndex === sourceIndex);
    if (direct) return direct.renderIndex;
    return Math.max(0, Math.min(spouseEntries.length - 1, sourceIndex));
  };
  const getMergeCenterForSpouseBranch = (parentNode, spouseCount, renderSpouseIndex) => {
    const parentPrimaryCenter = getPrimaryCenterForNode(parentNode, spouseCount);
    const spouseCenter = getSpouseCenterFromPrimary(parentPrimaryCenter, renderSpouseIndex);
    const isRightSide = spouseCenter >= parentPrimaryCenter;
    const primaryInteriorX = parentPrimaryCenter + (isRightSide ? nodeSize.width / 2 : -nodeSize.width / 2);
    const spouseInteriorX = spouseCenter + (isRightSide ? -nodeSize.width / 2 : nodeSize.width / 2);
    return (primaryInteriorX + spouseInteriorX) / 2;
  };
  const alignChildColumnsLikeDemo = () => {
    // Keep single-child branches centered like demo-tree:
    // no-spouse parent => child under parent primary;
    // spouse branch => child under that couple's merge center.
    root.descendants().forEach((parentNode) => {
      const childList = Array.isArray(parentNode.children) ? parentNode.children : [];
      if (childList.length === 0) return;

      const parentSpouseEntries = spouseEntriesByPrimaryId.get(parentNode.data.id) || [];
      const parentSpouseCount = parentSpouseEntries.length;

      if (parentSpouseCount === 0) {
        if (childList.length !== 1) return;
        const childNode = childList[0];
        const targetX = getPrimaryCenterForNode(parentNode, 0);
        const childPrimaryCenter = getPrimaryCenterForNode(childNode, getRenderableSpouseCount(childNode));
        shiftSubtreeX(childNode, targetX - childPrimaryCenter);
        return;
      }

      const childrenBySpouseRenderIndex = new Map();
      childList.forEach((childNode) => {
        const sourceIndex = getChildSpouseSourceIndexForAlign(childNode);
        const renderIndex = resolveRenderSpouseIndex(parentSpouseEntries, sourceIndex);
        if (!childrenBySpouseRenderIndex.has(renderIndex)) {
          childrenBySpouseRenderIndex.set(renderIndex, []);
        }
        childrenBySpouseRenderIndex.get(renderIndex).push(childNode);
      });

      childrenBySpouseRenderIndex.forEach((spouseChildren, renderIndex) => {
        if (spouseChildren.length !== 1) return;
        const childNode = spouseChildren[0];
        const targetX = getMergeCenterForSpouseBranch(parentNode, parentSpouseCount, renderIndex);
        const childPrimaryCenter = getPrimaryCenterForNode(childNode, getRenderableSpouseCount(childNode));
        shiftSubtreeX(childNode, targetX - childPrimaryCenter);
      });
    });
  };
  alignChildColumnsLikeDemo();

  nodes.forEach((node) => {
    const spouseEntries = spouseEntriesByPrimaryId.get(node.data.id) || [];
    if (!spouseEntries.length) return;
    if (!node.data.meta) return;

    const parentType = node.data.meta.type || '';
    const primaryCenterX = getPrimaryCenterForNode(node, spouseEntries.length);
    spouseEntries.forEach(({ spouse, sourceIndex, renderIndex, label }) => {

      const spouseMeta = {
        type: 'spouse',
        parentType,
        parentIndex: node.data.meta.parentIndex,
        childIndex: node.data.meta.childIndex,
        grandIndex: node.data.meta.grandIndex,
        targetType: node.data.meta.targetType,
        spouseIndex: sourceIndex
      };

      if (parentType === 'couple') {
        spouseMeta.addable = false;
        spouseMeta.path = Array.isArray(node.data.meta.path) ? node.data.meta.path.slice() : [];
      }

      const spouseNode = {
        x: getSpouseCenterFromPrimary(primaryCenterX, renderIndex),
        y: node.y,
        sourceSpouseIndex: sourceIndex,
        renderSpouseIndex: renderIndex,
        data: {
          id: `${node.data.id}-spouse-${sourceIndex}`,
          label,
          image: (spouse && typeof spouse === 'object' ? spouse.image : '') || '',
          meta: spouseMeta
        }
      };
      spouseNodes.push(spouseNode);
      // Map multiple spouses to the primary person
      if (!spouseByPrimaryId.has(node.data.id)) {
        spouseByPrimaryId.set(node.data.id, []);
      }
      spouseByPrimaryId.get(node.data.id).push(spouseNode);
    });
  });

  const renderNodes = nodes.concat(spouseNodes);

  // Ensure defs for clip paths
  let defs = visualState.svg.select('defs');
  if (defs.empty()) {
    defs = visualState.svg.append('defs');
    // Add gradient for hover effect
    const gradient = defs.append('linearGradient')
      .attr('id', 'editorPersonGradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '100%');
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'var(--accent-2)')
      .attr('stop-opacity', 0.22);
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'var(--accent)')
      .attr('stop-opacity', 0.22);
  }

  // Curved link path like demo-tree
  const linkGen = d3.linkVertical()
    .x((d) => d.x)
    .y((d) => d.y);
  const getPrimaryCardCenterX = (node) => {
    const spouseEntries = spouseEntriesByPrimaryId.get(node.data.id) || [];
    return getPrimaryCenterForNode(node, spouseEntries.length);
  };
  const getDrawX = (node) => {
    if (node.data.meta && node.data.meta.type === 'spouse') {
      return node.x;
    }
    return getPrimaryCardCenterX(node);
  };
  const topOfPrimary = (node) => ({
    x: getPrimaryCardCenterX(node),
    y: node.y - nodeSize.height / 2
  });
  const splitPad = 18;
  const mergePad = Math.max(24, nodeSize.height * 0.35);
  const mergeCurves = [];
  const marriageLines = [];
  const branches = [];
  const getChildSpouseSourceIndex = (childNode) => {
    const rawIndex = Number(childNode && childNode.data ? childNode.data.fromSpouseIndex : undefined);
    const fallback = (childNode && childNode.data && childNode.data.fromPrevSpouse) ? 1 : 0;
    const candidate = Number.isFinite(rawIndex) ? Math.trunc(rawIndex) : fallback;
    return Math.max(0, candidate);
  };
  const resolveChildSpouseNode = (childNode, spouseList) => {
    if (!Array.isArray(spouseList) || spouseList.length === 0) return null;
    const sourceIndex = getChildSpouseSourceIndex(childNode);
    const direct = spouseList.find((spouseNode) => {
      const spouseIndex = Number(spouseNode?.data?.meta?.spouseIndex);
      return Number.isFinite(spouseIndex) && Math.trunc(spouseIndex) === sourceIndex;
    });
    if (direct) return direct;
    const clamped = Math.max(0, Math.min(spouseList.length - 1, sourceIndex));
    return spouseList[clamped] || spouseList[0];
  };

  nodes.forEach((node) => {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const primaryCenterX = getPrimaryCardCenterX(node);
    const spouseList = spouseByPrimaryId.get(node.data.id) || [];
    const yCenter = node.y;
    const yMerge = yCenter + mergePad;
    const yJunction = node.y + nodeSize.height / 2 + splitPad;

    if (spouseList.length > 0) {
      const childrenBySpouseId = new Map();
      if (hasChildren) {
        node.children.forEach((child) => {
          const spouseNode = resolveChildSpouseNode(child, spouseList);
          if (!spouseNode) return;
          const spouseNodeId = spouseNode.data.id;
          if (!childrenBySpouseId.has(spouseNodeId)) {
            childrenBySpouseId.set(spouseNodeId, []);
          }
          childrenBySpouseId.get(spouseNodeId).push(child);
        });
      }

      spouseList.forEach((spouseNode) => {
        const isRightSide = spouseNode.x >= primaryCenterX;
        const primaryInterior = {
          x: primaryCenterX + (isRightSide ? nodeSize.width / 2 : -nodeSize.width / 2),
          y: yCenter
        };
        const spouseInterior = {
          x: spouseNode.x + (isRightSide ? -nodeSize.width / 2 : nodeSize.width / 2),
          y: yCenter
        };
        const spouseChildren = childrenBySpouseId.get(spouseNode.data.id) || [];

        if (spouseChildren.length === 0) {
          marriageLines.push({
            x0: Math.min(primaryInterior.x, spouseInterior.x),
            x1: Math.max(primaryInterior.x, spouseInterior.x),
            y: yCenter
          });
          return;
        }

        const xMerge = (primaryInterior.x + spouseInterior.x) / 2;
        const mergeTarget = { x: xMerge, y: yMerge };
        mergeCurves.push({ source: primaryInterior, target: mergeTarget });
        mergeCurves.push({ source: spouseInterior, target: mergeTarget });
        spouseChildren.forEach((child) => {
          branches.push({
            source: mergeTarget,
            target: topOfPrimary(child)
          });
        });
      });
      return;
    }

    if (!hasChildren) return;
    const branchSource = { x: primaryCenterX, y: yJunction };
    node.children.forEach((child) => {
      branches.push({
        source: branchSource,
        target: topOfPrimary(child)
      });
    });
  });

  function unionCurvePath(d) {
    const x0 = d.source.x;
    const y0 = d.source.y;
    const x1 = d.target.x;
    const y1 = d.target.y;
    const dx = x1 - x0;
    const dir = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    const lead = Math.max(12, Math.min(30, Math.abs(dx) * 0.33));
    const dy = Math.max(30, y1 - y0);
    const c1x = x0 + dir * lead;
    const c1y = y0;
    const c2x = x1;
    const c2y = y1 - dy * 0.6;
    return `M ${x0},${y0} C ${c1x},${c1y} ${c2x},${c2y} ${x1},${y1}`;
  }

  visualState.g.selectAll('.parent-merge')
    .data(mergeCurves)
    .join('path')
    .attr('class', 'link parent-link parent-merge')
    .attr('d', (d) => unionCurvePath(d));

  visualState.g.selectAll('.parent-marriage-line')
    .data(marriageLines)
    .join('path')
    .attr('class', 'link parent-link parent-marriage-line')
    .attr('d', (d) => `M ${d.x0},${d.y} H ${d.x1}`);

  visualState.g.selectAll('.parent-branch')
    .data(branches)
    .join('path')
    .attr('class', 'link parent-link parent-branch')
    .attr('d', (d) => linkGen(d));

  const nodeSel = visualState.g.selectAll('.person')
    .data(renderNodes, (d) => d.data.id);

  nodeSel.exit().remove();

  const nodeEnter = nodeSel.enter()
    .append('g')
    .attr('class', 'person');

  // Background rect
  nodeEnter.append('rect')
    .attr('width', nodeSize.width)
    .attr('height', nodeSize.height)
    .attr('rx', 16)
    .attr('ry', 16);

  // Avatar group
  const avatarGroup = nodeEnter.append('g')
    .attr('class', 'avatar-group')
    .attr('transform', `translate(${nodeSize.width / 2}, ${avatar.top + avatar.r})`);

  // Clip path for circular avatar
  avatarGroup.each(function(d) {
    const clipId = `clip-editor-${d.data.id}`;
    defs.append('clipPath')
      .attr('id', clipId)
      .append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', avatar.r);
  });

  // Avatar circle background
  avatarGroup.append('circle')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', avatar.r)
    .attr('fill', 'var(--surface-2)')
    .attr('stroke', 'var(--border)')
    .attr('stroke-width', 2);

  // Avatar image
  avatarGroup.append('image')
    .attr('x', -avatar.r)
    .attr('y', -avatar.r)
    .attr('width', avatar.r * 2)
    .attr('height', avatar.r * 2)
    .attr('clip-path', (d) => `url(#clip-editor-${d.data.id})`)
    .attr('preserveAspectRatio', 'xMidYMid slice');

  // Name text
  nodeEnter.append('text')
    .attr('class', 'name')
    .attr('x', nodeSize.width / 2)
    .attr('y', avatar.top + avatar.r * 2 + 22)
    .attr('text-anchor', 'middle');

  // Add button
  nodeEnter.append('g')
    .attr('class', 'node-add')
    .attr('transform', `translate(${nodeSize.width - 16}, ${-10})`)
    .on('click', (event, d) => {
      event.stopPropagation();
      showAddMemberPopup(event, d.data.meta);
    })
    .call((g) => {
      g.append('circle').attr('r', 12);
      g.append('text').text('+').attr('y', 1);
    });

  // Delete button
  nodeEnter.append('g')
    .attr('class', 'node-delete')
    .attr('transform', `translate(${nodeSize.width - 16}, ${nodeSize.height - 10})`)
    .on('click', (event, d) => {
      event.stopPropagation();
      deleteMember(d.data.meta);
    })
    .call((g) => {
      g.append('circle').attr('r', 12);
      g.append('text').text('−').attr('y', 1);
    });

  // Update all nodes
  const mergedNodes = nodeEnter.merge(nodeSel);
  mergedNodes
    .attr('transform', (d) => {
      const drawX = getDrawX(d);
      d._drawX = drawX;
      return `translate(${drawX - nodeSize.width / 2}, ${d.y - nodeSize.height / 2})`;
    })
    .on('click', (event, d) => {
      if (event.defaultPrevented) return;
      event.stopPropagation();
      showEditMemberModal(d.data.meta);
    });
  
  // Update avatar images with fallback
  const placeholderUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><rect fill="#e2e8f0" width="72" height="72"/><circle cx="36" cy="28" r="12" fill="#94a3b8"/><ellipse cx="36" cy="58" rx="20" ry="14" fill="#94a3b8"/></svg>');
  
  mergedNodes.select('.avatar-group image')
    .attr('href', (d) => d.data.image || placeholderUrl)
    .on('error', function() {
      d3.select(this).attr('href', placeholderUrl);
    });

  // Update name text
  mergedNodes.select('text.name')
    .text((d) => d.data.label);

  // Show/hide add button - everyone gets a + button
  mergedNodes.select('.node-add')
    .style('display', (d) => (d.data.meta && d.data.meta.addable === false ? 'none' : 'block'));

  // Show/hide delete button - everyone except root gets a - button
  mergedNodes.select('.node-delete')
    .style('display', (d) => (d.data.meta && d.data.meta.type === 'root' ? 'none' : 'block'));

  if (resetTransform || !visualState.hasUserTransform) {
    centerVisualTree(renderNodes, nodeSize);
  }
}

function centerVisualTree(nodes, nodeSize) {
  if (!visualState.svg || !visualState.zoom || !nodes.length) return;
  const svgNode = visualState.svg.node();
  const rect = svgNode.getBoundingClientRect();
  // Use actual dimensions or fallback to 620px
  const width = rect.width || 800;
  const height = rect.height || 620;
  const minX = d3.min(nodes, (d) => (d._drawX !== undefined ? d._drawX : d.x)) - nodeSize.width / 2;
  const maxX = d3.max(nodes, (d) => (d._drawX !== undefined ? d._drawX : d.x)) + nodeSize.width / 2;
  const minY = d3.min(nodes, (d) => d.y) - nodeSize.height / 2;
  const maxY = d3.max(nodes, (d) => d.y) + nodeSize.height / 2;
  const treeWidth = Math.max(1, maxX - minX);
  const treeHeight = Math.max(1, maxY - minY);
  const padding = 80;
  const scale = Math.min(1, Math.min((width - padding) / treeWidth, (height - padding) / treeHeight));
  const translateX = width / 2 - ((minX + maxX) / 2) * scale;
  const translateY = height / 2 - ((minY + maxY) / 2) * scale;
  const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
  visualState.svg.call(visualState.zoom.transform, transform);
  visualState.hasUserTransform = false;
}


function ensureDefaultTreeData(data) {
  if (data && typeof data === 'object' && Object.keys(data).length > 0) {
    // Clean up duplicate root nodes created during setup
    return cleanupTreeData(data);
  }
  return createDefaultTreeData(getDefaultPersonName());
}

function cleanupTreeData(data) {
  if (!data || typeof data !== 'object') return data;
  
  // Clone to avoid mutating original
  const cleaned = JSON.parse(JSON.stringify(data));
  
  // If this looks like an RFamilySchema, check for duplicates
  if (cleaned.Grandparent && Array.isArray(cleaned.Parent)) {
    const grandparentName = safeText(cleaned.Grandparent);
    
    if (grandparentName) {
      // Check if Grandparent appears as a child in Parent array
      // This happens when the setup creates a duplicate entry
      cleaned.Parent = cleaned.Parent.filter(parent => {
        const childrenNames = parent.children && Array.isArray(parent.children) 
          ? parent.children.map(c => safeText(c.name))
          : [];
        
        // Remove if this parent has only one child with the same name as Grandparent
        // (this indicates it's a duplicate created during setup)
        if (childrenNames.length === 1 && childrenNames[0] === grandparentName) {
          // Only remove if this parent looks like it should have been in 'parents' property
          // i.e., only one entry in Parent array with one child
          if (cleaned.Parent.length === 1) {
            // Move this parent to the parents property instead
            const parentEntry = parent;
            if (!cleaned.parents) {
              cleaned.parents = {
                name: parentEntry.name,
                image: parentEntry.image || '',
                birthday: parentEntry.birthday || '',
                spouse: parentEntry.spouse || null
              };
            }
            return false; // Remove from Parent array
          }
        }
        return true; // Keep in Parent array
      });
    }
  }
  
  return cleaned;
}

function createDefaultTreeData(name) {
  return {
    Grandparent: name,
    image: '',
    birthday: '',
    Parent: []
  };
}

function getDefaultPersonName() {
  const displayName = currentUser && currentUser.displayName ? currentUser.displayName.trim() : '';
  if (displayName) return displayName;
  const email = currentUser && currentUser.email ? currentUser.email.trim() : '';
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Family Member';
}

function buildVisualTreeData(data) {
  if (!data || typeof data !== 'object') return null;
  let tree = null;
  if (looksLikeRFamilySchema(data)) {
    tree = buildRFamilyTree(data);
  } else if (data.name || data.spouse || Array.isArray(data.children)) {
    tree = buildCoupleTree(data, []);
  }
  if (!tree) return null;
  return sortTreeBySpouseGroup(tree);
}

function buildRFamilyTree(src) {
  const rootLabel = formatCoupleLabel(src.Grandparent, null);
  const rootSpouses = extractSpouses(src.spouse);
  const root = {
    id: 'root',
    label: rootLabel || 'Root',
    image: src.image || '',
    spouses: rootSpouses,
    meta: { type: 'root' },
    children: []
  };
  
  const parents = Array.isArray(src.Parent) ? src.Parent : [];
  parents.forEach((p, parentIndex) => {
    const parentSpouses = extractSpouses(p.spouse);
    const rawParentSpouseIndex = Number(p.fromSpouseIndex);
    const parentFromSpouseIndex = Number.isFinite(rawParentSpouseIndex)
      ? Math.max(0, Math.trunc(rawParentSpouseIndex))
      : (p.fromPrevSpouse ? 1 : 0);
    const parentNode = {
      id: `p-${parentIndex}`,
      label: formatCoupleLabel(p.name, null),
      image: p.image || '',
      spouses: parentSpouses,
      fromSpouseIndex: parentFromSpouseIndex,
      fromPrevSpouse: !!p.fromPrevSpouse || parentFromSpouseIndex > 0,
      meta: { type: 'parent', parentIndex },
      children: []
    };
    
    const kids = getRFamilyChildrenList(p, false) || [];
    kids.forEach((k, childIndex) => {
      const childSpouses = extractSpouses(k.spouse);
      const rawSpouseIndex = Number(k.fromSpouseIndex);
      const fromSpouseIndex = Number.isFinite(rawSpouseIndex)
        ? Math.max(0, Math.trunc(rawSpouseIndex))
        : (k.fromPrevSpouse ? 1 : 0);
      const childNode = {
        id: `c-${parentIndex}-${childIndex}`,
        label: formatCoupleLabel(k.name, null),
        image: k.image || '',
        spouses: childSpouses,
        fromSpouseIndex,
        fromPrevSpouse: !!k.fromPrevSpouse || fromSpouseIndex > 0,
        meta: { type: 'child', parentIndex, childIndex, fromSpouseIndex },
        children: []
      };
      
      const grandkids = Array.isArray(k.grandchildren) ? k.grandchildren : [];
      grandkids.forEach((g, grandIndex) => {
        const rawGrandSpouseIndex = Number(g.fromSpouseIndex);
        const grandFromSpouseIndex = Number.isFinite(rawGrandSpouseIndex)
          ? Math.max(0, Math.trunc(rawGrandSpouseIndex))
          : (g.fromPrevSpouse ? 1 : 0);
        const grandNode = {
          id: `g-${parentIndex}-${childIndex}-${grandIndex}`,
          label: safeText(g.name) || 'Member',
          image: g.image || '',
          fromSpouseIndex: grandFromSpouseIndex,
          fromPrevSpouse: !!g.fromPrevSpouse || grandFromSpouseIndex > 0,
          meta: { type: 'grandchild', parentIndex, childIndex, grandIndex, addable: false },
          children: []
        };
        const wrappedGrand = wrapRFamilyNodeWithParents(grandNode, g.parents, {
          type: 'grandchild',
          parentIndex,
          childIndex,
          grandIndex
        });
        childNode.children.push(wrappedGrand);
      });
      const wrappedChild = wrapRFamilyNodeWithParents(childNode, k.parents, {
        type: 'child',
        parentIndex,
        childIndex
      });
      parentNode.children.push(wrappedChild);
    });
    const wrappedParent = wrapRFamilyNodeWithParents(parentNode, p.parents, {
      type: 'parent',
      parentIndex
    });
    root.children.push(wrappedParent);
  });
  return wrapRFamilyNodeWithParents(root, src.parents, { type: 'root' });
}

function extractSpouses(spouseData) {
  // Handle backwards compatibility: convert old single-spouse format to array
  if (!spouseData) return [];
  if (Array.isArray(spouseData)) return spouseData;
  // Old format: single object becomes array with one element
  return [spouseData];
}

function wrapRFamilyNodeWithParents(node, parentsData, targetMeta) {
  if (!parentsData || typeof parentsData !== 'object') return node;
  const parentSpouses = extractSpouses(parentsData.spouse);
  const spouseIndex = getNodeSpouseIndex(node);
  return {
    id: `ancestor-${node.id}`,
    label: formatCoupleLabel(parentsData.name, null) || 'Parent',
    image: parentsData.image || '',
    spouses: parentSpouses,
    fromSpouseIndex: spouseIndex,
    fromPrevSpouse: spouseIndex > 0 || !!node.fromPrevSpouse,
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

function buildCoupleTree(node, path) {
  const label = formatCoupleLabel(node.name, node.spouse);
  const children = Array.isArray(node.children) ? node.children : [];
  const spouses = node.spouses || extractSpouses(node.spouse);
  const rawSpouseIndex = Number(node.fromSpouseIndex);
  const fromSpouseIndex = Number.isFinite(rawSpouseIndex)
    ? Math.max(0, Math.trunc(rawSpouseIndex))
    : (node.fromPrevSpouse ? 1 : 0);
  return {
    id: `n-${path.join('-') || 'root'}`,
    label: label || 'Member',
    image: node.image || '',
    spouses: spouses,
    fromSpouseIndex,
    fromPrevSpouse: !!node.fromPrevSpouse || fromSpouseIndex > 0,
    meta: { type: 'couple', path: path.slice() },
    children: children.map((child, index) => buildCoupleTree(child, path.concat(index)))
  };
}

function getNodeSpouseIndex(node) {
  if (!node || typeof node !== 'object') return 0;
  const rawSpouseIndex = Number(node.fromSpouseIndex);
  if (Number.isFinite(rawSpouseIndex)) {
    return Math.max(0, Math.trunc(rawSpouseIndex));
  }
  return node.fromPrevSpouse ? 1 : 0;
}

function sortTreeBySpouseGroup(node) {
  if (!node || typeof node !== 'object') return node;
  if (!Array.isArray(node.children) || node.children.length === 0) return node;

  node.children = node.children
    .map((child, index) => ({ child, index }))
    .sort((a, b) => {
      const spouseDiff = getNodeSpouseIndex(b.child) - getNodeSpouseIndex(a.child);
      if (spouseDiff !== 0) return spouseDiff;
      return a.index - b.index;
    })
    .map((entry) => sortTreeBySpouseGroup(entry.child));

  return node;
}

function looksLikeRFamilySchema(obj) {
  return obj && (obj.Parent || obj.Grandparent);
}

function safeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function formatCoupleLabel(primary, spouse) {
  const main = safeText(primary);
  // Only show primary person's name - spouse will be rendered as separate node
  return main || 'Member';
}

function addMemberAt(meta, memberData) {
  if (!meta) return;
  if (meta.addable === false) return;
  
  const name = memberData?.name || prompt('Name for the new member:');
  if (!name || !name.trim()) return;
  
  const jsonEditor = document.getElementById('jsonEditor');
  let treeData;
  try {
    treeData = JSON.parse(jsonEditor.value || '{}');
  } catch (e) {
    alert('JSON is invalid. Fix it before adding members.');
    return;
  }

  // Build member object with all collected data
  const newMember = {
    name: name.trim(),
    image: memberData?.image || '',
    birthday: memberData?.birthday || ''
  };
  
  if (memberData?.visited && memberData.visited.length > 0) {
    newMember.visited = memberData.visited;
  }

  if (looksLikeRFamilySchema(treeData)) {
    // Use the relation type to determine what to add
    const relation = meta.relation || 'child'; // Default to child if not specified
    
    if (meta.type === 'root') {
      if (relation === 'parent') {
        addOrAppendParent(treeData, newMember);
      } else if (relation === 'spouse') {
        // Add spouse to array
        if (!Array.isArray(treeData.spouse)) {
          treeData.spouse = treeData.spouse ? [treeData.spouse] : [];
        }
        treeData.spouse.push(newMember);
      } else if (relation === 'child') {
        // Add child - goes into Parent array as a new parent generation
        if (!Array.isArray(treeData.Parent)) {
          treeData.Parent = treeData.Parent ? [treeData.Parent] : [];
        }
        treeData.Parent.push(newMember);
      }
    } else if (meta.type === 'parent') {
      const parent = getRFamilyParent(treeData, meta.parentIndex);
      if (!parent) return;
      
      if (relation === 'child') {
        const targetChildren = getRFamilyChildrenList(parent, true);
        targetChildren.push(newMember);
      } else if (relation === 'parent') {
        addOrAppendParent(parent, newMember);
      } else if (relation === 'spouse') {
        // Add spouse to array
        if (!Array.isArray(parent.spouse)) {
          parent.spouse = parent.spouse ? [parent.spouse] : [];
        }
        parent.spouse.push(newMember);
      }
    } else if (meta.type === 'child') {
      const child = getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
      if (!child) return;
      
      if (relation === 'child') {
        if (!Array.isArray(child.grandchildren)) child.grandchildren = [];
        child.grandchildren.push(newMember);
      } else if (relation === 'parent') {
        addOrAppendParent(child, newMember);
      } else if (relation === 'spouse') {
        // Add spouse to array
        if (!Array.isArray(child.spouse)) {
          child.spouse = child.spouse ? [child.spouse] : [];
        }
        child.spouse.push(newMember);
      }
    } else if (meta.type === 'grandchild') {
      const grandchild = getRFamilyGrandchild(treeData, meta.parentIndex, meta.childIndex, meta.grandIndex);
      if (!grandchild) return;
      if (relation === 'parent') {
        addOrAppendParent(grandchild, newMember);
      }
    } else if (meta.type === 'ancestor') {
      const target = getRFamilyTargetNode(treeData, meta);
      if (!target) return;
      if (relation === 'parent') {
        addOrAppendParent(target, newMember);
      } else if (relation === 'spouse') {
        const parentsData = getRFamilyParentsData(treeData, meta, true);
        addSpouseToParentsData(parentsData, newMember);
      } else if (relation === 'child') {
        if (meta.targetType === 'child') {
          const parent = getRFamilyParent(treeData, meta.parentIndex);
          if (!parent) return;
          const targetChildren = getRFamilyChildrenList(parent, true);
          targetChildren.push(newMember);
        } else if (meta.targetType === 'grandchild') {
          const child = getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
          if (!child) return;
          if (!Array.isArray(child.grandchildren)) child.grandchildren = [];
          child.grandchildren.push(newMember);
        }
      }
    } else if (meta.type === 'spouse') {
      // When clicking + on a spouse node, check relation type
      const parentType = meta.parentType;
      if (relation === 'spouse') {
        // Add another spouse to the same person
        if (parentType === 'root') {
          if (!Array.isArray(treeData.spouse)) {
            treeData.spouse = treeData.spouse ? [treeData.spouse] : [];
          }
          treeData.spouse.push(newMember);
        } else if (parentType === 'ancestor') {
          const parentsData = getRFamilyParentsData(treeData, meta, true);
          if (!parentsData) return;
          if (!Array.isArray(parentsData.spouse)) {
            parentsData.spouse = parentsData.spouse ? [parentsData.spouse] : [];
          }
          parentsData.spouse.push(newMember);
        } else if (parentType === 'parent') {
          const parent = getRFamilyParent(treeData, meta.parentIndex);
          if (!parent) return;
          if (!Array.isArray(parent.spouse)) {
            parent.spouse = parent.spouse ? [parent.spouse] : [];
          }
          parent.spouse.push(newMember);
        } else if (parentType === 'child') {
          const child = getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
          if (!child) return;
          if (!Array.isArray(child.spouse)) {
            child.spouse = child.spouse ? [child.spouse] : [];
          }
          child.spouse.push(newMember);
        }
      } else if (relation === 'child') {
        // Add child to the person that this spouse is linked to
        const spouseIndex = Number.isFinite(Number(meta.spouseIndex)) ? Math.max(0, Math.trunc(Number(meta.spouseIndex))) : 0;
        const childForSpouse = spouseIndex > 0
          ? { ...newMember, fromSpouseIndex: spouseIndex, fromPrevSpouse: true }
          : { ...newMember };
        if (parentType === 'root') {
          if (!Array.isArray(treeData.Parent)) {
            treeData.Parent = treeData.Parent ? [treeData.Parent] : [];
          }
          insertChildForSpouse(treeData.Parent, childForSpouse, spouseIndex);
        } else if (parentType === 'parent') {
          const parent = getRFamilyParent(treeData, meta.parentIndex);
          if (!parent) return;
          const targetChildren = getRFamilyChildrenList(parent, true);
          insertChildForSpouse(targetChildren, childForSpouse, spouseIndex);
        } else if (parentType === 'child') {
          const child = getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
          if (!child) return;
          if (!Array.isArray(child.grandchildren)) child.grandchildren = [];
          insertChildForSpouse(child.grandchildren, childForSpouse, spouseIndex);
        }
      }
    }
  } else {
    const relation = meta.relation || 'child';
    const path = meta.path || [];
    if (relation === 'parent') {
      const newParent = { ...newMember, spouse: '', children: [] };
      if (path.length === 0) {
        const oldRoot = treeData;
        newParent.children = [oldRoot];
        treeData = newParent;
      } else {
        const parentPath = path.slice(0, -1);
        const parentNode = getCoupleNodeByPath(treeData, parentPath);
        if (!parentNode || !Array.isArray(parentNode.children)) return;
        const childIndex = path[path.length - 1];
        const oldNode = parentNode.children[childIndex];
        if (!oldNode) return;
        newParent.children = [oldNode];
        parentNode.children.splice(childIndex, 1, newParent);
      }
    } else {
      const target = getCoupleNodeByPath(treeData, path);
      if (!target) return;
      if (!Array.isArray(target.children)) target.children = [];
      target.children.push({ ...newMember, spouse: '', children: [] });
    }
  }

  jsonEditor.value = JSON.stringify(treeData, null, 2);
  markAsChanged();
  scheduleVisualRender(false);
}

function getRFamilyParent(treeData, parentIndex) {
  if (!Array.isArray(treeData.Parent)) return null;
  return treeData.Parent[parentIndex] || null;
}

function getRFamilyChildrenList(parent, createIfMissing) {
  if (!parent || typeof parent !== 'object') return null;
  if (Array.isArray(parent.children)) return parent.children;
  if (Array.isArray(parent.grandchildren)) {
    if (createIfMissing) {
      parent.children = parent.grandchildren;
      delete parent.grandchildren;
      return parent.children;
    }
    return parent.grandchildren;
  }
  if (!createIfMissing) return null;
  parent.children = [];
  return parent.children;
}

function getStoredSpouseIndex(member) {
  if (!member || typeof member !== 'object') return 0;
  const rawSpouseIndex = Number(member.fromSpouseIndex);
  if (Number.isFinite(rawSpouseIndex)) {
    return Math.max(0, Math.trunc(rawSpouseIndex));
  }
  return member.fromPrevSpouse ? 1 : 0;
}

function insertChildForSpouse(targetList, member, spouseIndex) {
  if (!Array.isArray(targetList) || !member) return;
  const normalizedSpouseIndex = Number.isFinite(Number(spouseIndex))
    ? Math.max(0, Math.trunc(Number(spouseIndex)))
    : 0;
  let insertAt = targetList.length;
  for (let i = 0; i < targetList.length; i += 1) {
    if (getStoredSpouseIndex(targetList[i]) < normalizedSpouseIndex) {
      insertAt = i;
      break;
    }
  }
  targetList.splice(insertAt, 0, member);
}

function getRFamilyChild(treeData, parentIndex, childIndex) {
  const parent = getRFamilyParent(treeData, parentIndex);
  const children = getRFamilyChildrenList(parent, false);
  if (!children) return null;
  return children[childIndex] || null;
}

function getRFamilyGrandchild(treeData, parentIndex, childIndex, grandIndex) {
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

function addSpouseToParentsData(parentsData, newMember) {
  if (!parentsData || !newMember) return;
  if (!Array.isArray(parentsData.spouse)) {
    parentsData.spouse = parentsData.spouse ? [parentsData.spouse] : [];
  }
  parentsData.spouse.push(newMember);
}

function addOrAppendParent(target, newMember) {
  if (!target || !newMember) return;
  if (!target.parents || typeof target.parents !== 'object') {
    target.parents = newMember;
    return;
  }
  const parentsData = target.parents;
  const existingName = safeText(parentsData.name);
  if (!existingName) {
    Object.assign(parentsData, newMember);
    return;
  }
  addSpouseToParentsData(parentsData, newMember);
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

function getCoupleNodeByPath(treeData, path) {
  let node = treeData;
  for (let i = 0; i < path.length; i += 1) {
    if (!node || !Array.isArray(node.children)) return null;
    node = node.children[path[i]];
  }
  return node;
}

// ============ DELETE MEMBER ============

function deleteMember(meta) {
  if (!meta) return;

  // Don't allow deleting root
  if (meta.type === 'root') {
    alert('Cannot delete the root person');
    return;
  }

  // Store the meta data and show the delete confirmation modal
  pendingDeleteMeta = meta;
  showDeleteConfirmModal();
}

function showDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function hideDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  if (modal) {
    modal.style.display = 'none';
  }
  pendingDeleteMeta = null;
}

function performDelete() {
  const meta = pendingDeleteMeta;
  if (!meta) return;

  const jsonEditor = document.getElementById('jsonEditor');
  let treeData;
  try {
    treeData = JSON.parse(jsonEditor.value || '{}');
  } catch (e) {
    alert('JSON is invalid. Fix it before deleting members.');
    hideDeleteConfirmModal();
    return;
  }

  if (looksLikeRFamilySchema(treeData)) {
    if (meta.type === 'spouse') {
      // Delete spouse from array based on parent type
      const spouseIndex = meta.spouseIndex !== undefined ? meta.spouseIndex : 0;
      if (meta.parentType === 'root') {
        if (Array.isArray(treeData.spouse)) {
          treeData.spouse.splice(spouseIndex, 1);
        }
      } else if (meta.parentType === 'ancestor') {
        const parentsData = getRFamilyParentsData(treeData, meta, false);
        if (parentsData && Array.isArray(parentsData.spouse)) {
          parentsData.spouse.splice(spouseIndex, 1);
        }
      } else if (meta.parentType === 'parent') {
        const parent = getRFamilyParent(treeData, meta.parentIndex);
        if (parent && Array.isArray(parent.spouse)) {
          parent.spouse.splice(spouseIndex, 1);
        }
      } else if (meta.parentType === 'child') {
        const child = getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
        if (child && Array.isArray(child.spouse)) {
          child.spouse.splice(spouseIndex, 1);
        }
      }
    } else if (meta.type === 'ancestor') {
      const target = getRFamilyTargetNode(treeData, meta);
      if (target) {
        target.parents = null;
      }
    } else if (meta.type === 'parent') {
      // Delete parent from array
      if (Array.isArray(treeData.Parent)) {
        treeData.Parent.splice(meta.parentIndex, 1);
      }
    } else if (meta.type === 'child') {
      // Delete child from parent's children array
      const parent = getRFamilyParent(treeData, meta.parentIndex);
      const children = getRFamilyChildrenList(parent, false);
      if (children) {
        children.splice(meta.childIndex, 1);
      }
    } else if (meta.type === 'grandchild') {
      // Delete grandchild from child's grandchildren array
      const child = getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
      if (child && Array.isArray(child.grandchildren)) {
        child.grandchildren.splice(meta.grandIndex, 1);
      }
    }
  } else {
    // Handle couple tree format
    const target = getCoupleNodeByPath(treeData, meta.path || []);
    if (target && Array.isArray(target.children)) {
      // Find and remove the child
      const index = target.children.findIndex((c) => c.name === meta.name);
      if (index !== -1) {
        target.children.splice(index, 1);
      }
    }
  }

  jsonEditor.value = JSON.stringify(treeData, null, 2);
  markAsChanged();
  scheduleVisualRender(false);
  hideDeleteConfirmModal();
}

// ============ ADD / EDIT MEMBER POPUP & MODAL ============

function initAddMemberUI() {
  const popup = document.getElementById('addMemberPopup');
  const modal = document.getElementById('addMemberModal');
  const expandBtn = popup?.querySelector('.add-member-expand-btn');
  
  if (!popup || !modal) return;

  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && !e.target.closest('.node-add') && !e.target.closest('#addPersonBtn')) {
      hideAddMemberPopup();
    }
  });

  expandBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.toggle('is-active');
  });

  // Popup item clicks
  popup.querySelectorAll('.add-member-popup-item').forEach(item => {
    item.addEventListener('click', () => {
      pendingAddRelation = item.dataset.relation;
      hideAddMemberPopup();
      showAddMemberModal(pendingAddRelation);
    });
  });

  // Modal close handlers
  document.getElementById('closeAddMemberModal')?.addEventListener('click', hideAddMemberModal);
  document.getElementById('cancelAddMember')?.addEventListener('click', hideAddMemberModal);
  document.getElementById('confirmAddMember')?.addEventListener('click', confirmMemberModal);

  // Photo upload
  const photoPreview = document.getElementById('photoUploadPreview');
  const photoInput = document.getElementById('memberPhotoInput');
  photoPreview?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', handleMemberPhotoSelect);

  // Visited countries rows
  document.getElementById('addVisitedCountryBtn')?.addEventListener('click', () => {
    addVisitedCountryRow('');
  });

  // Close modal on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideAddMemberModal();
    }
  });
}

function showAddMemberPopup(event, meta) {
  const popup = document.getElementById('addMemberPopup');
  if (!popup) return;

  pendingAddMemberMeta = meta;

  // Add active class to the clicked + button (SVG element)
  if (event.currentTarget) {
    d3.select(event.currentTarget).classed('active', true);
  }

  // Get the position from the click event (which comes from the SVG + button)
  const x = event.clientX || event.pageX;
  const y = event.clientY || event.pageY;
  const popupSize = 200;
  const viewportPadding = 12;

  let adjustedX = x - popupSize / 2;
  let adjustedY = y - popupSize / 2;

  if (adjustedX < viewportPadding) adjustedX = viewportPadding;
  if (adjustedY < viewportPadding) adjustedY = viewportPadding;
  if (adjustedX + popupSize > window.innerWidth - viewportPadding) {
    adjustedX = Math.max(viewportPadding, window.innerWidth - popupSize - viewportPadding);
  }
  if (adjustedY + popupSize > window.innerHeight - viewportPadding) {
    adjustedY = Math.max(viewportPadding, window.innerHeight - popupSize - viewportPadding);
  }

  // Position popup with center aligned to the click point
  popup.style.left = `${adjustedX}px`;
  popup.style.top = `${adjustedY}px`;
  popup.classList.add('show');
  popup.classList.add('is-active');
}

function hideAddMemberPopup() {
  const popup = document.getElementById('addMemberPopup');
  if (popup) {
    popup.classList.remove('show');
    popup.classList.remove('is-active');
    document.querySelectorAll('.node-add.active').forEach(btn => {
      d3.select(btn).classed('active', false);
    });
  }
  // Don't clear pendingAddMemberMeta here - we still need it for the modal form.
}

function showAddMemberModal(relation) {
  const modal = document.getElementById('addMemberModal');
  const title = document.getElementById('addMemberTitle');
  const confirmBtn = document.getElementById('confirmAddMember');
  const titleIcon = document.querySelector('.add-member-header h3 .material-symbols-outlined');
  
  if (!modal) return;

  memberModalMode = 'add';
  pendingEditMeta = null;

  const titles = {
    parent: 'Add Parent',
    spouse: 'Add Spouse',
    child: 'Add Child'
  };
  if (title) {
    title.textContent = titles[relation] || 'Add Family Member';
  }
  if (confirmBtn) {
    confirmBtn.textContent = 'Add Member';
  }
  if (titleIcon) {
    titleIcon.textContent = 'person_add';
  }

  resetAddMemberForm();
  modal.classList.add('show');
}

function showEditMemberModal(meta) {
  if (!meta) return;

  const modal = document.getElementById('addMemberModal');
  const title = document.getElementById('addMemberTitle');
  const confirmBtn = document.getElementById('confirmAddMember');
  const titleIcon = document.querySelector('.add-member-header h3 .material-symbols-outlined');
  const jsonEditor = document.getElementById('jsonEditor');
  if (!modal || !jsonEditor) return;

  hideAddMemberPopup();

  let treeData;
  try {
    treeData = JSON.parse(jsonEditor.value || '{}');
  } catch (e) {
    alert('JSON is invalid. Fix it before editing members.');
    return;
  }

  const existing = getMemberAtMeta(treeData, meta);
  if (!existing) {
    alert('Could not load this person for editing.');
    return;
  }

  memberModalMode = 'edit';
  pendingEditMeta = { ...meta };
  pendingAddMemberMeta = null;
  pendingAddRelation = null;

  if (title) {
    title.textContent = 'Edit Family Member';
  }
  if (confirmBtn) {
    confirmBtn.textContent = 'Save Changes';
  }
  if (titleIcon) {
    titleIcon.textContent = 'edit';
  }

  resetAddMemberForm();
  fillMemberForm(existing);
  modal.classList.add('show');
}

function hideAddMemberModal() {
  const modal = document.getElementById('addMemberModal');
  if (modal) {
    modal.classList.remove('show');
  }
  pendingAddMemberMeta = null;
  pendingAddRelation = null;
  pendingEditMeta = null;
  memberModalMode = 'add';
}

function resetAddMemberForm() {
  const firstNameInput = document.getElementById('memberFirstName');
  const lastNameInput = document.getElementById('memberLastName');
  const birthdayInput = document.getElementById('memberBirthday');
  if (firstNameInput) firstNameInput.value = '';
  if (lastNameInput) lastNameInput.value = '';
  if (birthdayInput) birthdayInput.value = '';

  updateMemberPhotoPreview('');

  const photoInput = document.getElementById('memberPhotoInput');
  if (photoInput) {
    photoInput.value = '';
  }

  visitedCountries = [''];
  renderVisitedCountryRows();
}

function fillMemberForm(memberData) {
  const firstNameInput = document.getElementById('memberFirstName');
  const lastNameInput = document.getElementById('memberLastName');
  const birthdayInput = document.getElementById('memberBirthday');
  const nameParts = splitMemberName(memberData?.name || '');
  if (firstNameInput) firstNameInput.value = nameParts.firstName;
  if (lastNameInput) lastNameInput.value = nameParts.lastName;
  if (birthdayInput) birthdayInput.value = memberData?.birthday || '';

  updateMemberPhotoPreview(memberData?.image || '');

  visitedCountries = normalizeVisitedCountries(memberData?.visited);
  if (!visitedCountries.length) {
    visitedCountries = [''];
  }
  renderVisitedCountryRows();
}

function handleMemberPhotoSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const result = typeof loadEvent.target?.result === 'string' ? loadEvent.target.result : '';
    updateMemberPhotoPreview(result);
  };
  reader.readAsDataURL(file);
}

function updateMemberPhotoPreview(imageValue) {
  const photoPreview = document.getElementById('photoUploadPreview');
  const photoImg = document.getElementById('photoPreviewImg');
  const photoIcon = photoPreview?.querySelector('.material-symbols-outlined');
  memberPhotoValue = safeText(imageValue);

  if (photoImg) {
    if (memberPhotoValue) {
      photoImg.src = memberPhotoValue;
      photoImg.style.display = 'block';
    } else {
      photoImg.src = '';
      photoImg.style.display = 'none';
    }
  }

  if (photoIcon) {
    photoIcon.style.display = memberPhotoValue ? 'none' : 'block';
  }
}

function addVisitedCountryRow(value = '') {
  visitedCountries.push(value);
  renderVisitedCountryRows();
}

function renderVisitedCountryRows() {
  const list = document.getElementById('visitedCountriesList');
  if (!list) return;

  if (!visitedCountries.length) {
    visitedCountries = [''];
  }

  list.innerHTML = '';
  visitedCountries.forEach((country, index) => {
    const row = document.createElement('div');
    row.className = 'person-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field-input person-row-input';
    input.placeholder = 'Country name';
    input.value = country;
    input.addEventListener('input', (event) => {
      visitedCountries[index] = event.target.value;
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-secondary btn-inline btn-remove-person';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      if (visitedCountries.length === 1) {
        visitedCountries[0] = '';
      } else {
        visitedCountries.splice(index, 1);
      }
      renderVisitedCountryRows();
    });

    row.appendChild(input);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function normalizeVisitedCountries(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => safeText(entry))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => safeText(entry))
      .filter(Boolean);
  }
  return [];
}

function collectVisitedCountriesFromForm() {
  return visitedCountries
    .map((entry) => safeText(entry))
    .filter(Boolean);
}

function splitMemberName(fullName) {
  const parts = safeText(fullName).split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: '', lastName: '' };
  }
  const firstName = parts.shift() || '';
  return {
    firstName,
    lastName: parts.join(' ')
  };
}

function collectMemberFormData() {
  const firstNameEl = document.getElementById('memberFirstName');
  const lastNameEl = document.getElementById('memberLastName');
  const birthdayEl = document.getElementById('memberBirthday');
  if (!firstNameEl || !lastNameEl || !birthdayEl) {
    alert('Error: Form elements not found');
    return null;
  }

  const firstName = firstNameEl.value.trim();
  const lastName = lastNameEl.value.trim();
  if (!firstName || !lastName) {
    alert('Please fill in both First Name and Last Name');
    return null;
  }

  return {
    name: `${firstName} ${lastName}`.trim(),
    image: memberPhotoValue,
    birthday: birthdayEl.value.trim(),
    visited: collectVisitedCountriesFromForm()
  };
}

function confirmMemberModal() {
  const memberData = collectMemberFormData();
  if (!memberData) return;

  if (memberModalMode === 'edit') {
    if (!pendingEditMeta) {
      alert('Error: Could not determine which member to edit.');
      return;
    }
    const updated = updateMemberAt(pendingEditMeta, memberData);
    if (!updated) {
      return;
    }
    hideAddMemberModal();
    return;
  }

  if (!pendingAddMemberMeta) {
    alert('Error: Could not determine where to add member.');
    return;
  }

  const metaWithRelation = { ...pendingAddMemberMeta, relation: pendingAddRelation };
  addMemberAt(metaWithRelation, memberData);
  hideAddMemberModal();
}

function extractMemberDataFromRecord(record, nameField = 'name') {
  if (record === null || record === undefined) return null;
  if (typeof record === 'string') {
    const name = safeText(record);
    if (!name) return null;
    return { name, image: '', birthday: '', visited: [] };
  }
  if (typeof record !== 'object') return null;

  const name = safeText(record[nameField]);
  if (!name) return null;

  return {
    name,
    image: safeText(record.image),
    birthday: safeText(record.birthday),
    visited: normalizeVisitedCountries(record.visited)
  };
}

function normalizeIndex(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function getRFamilySpouseContainer(treeData, meta) {
  if (!meta) return null;
  if (meta.parentType === 'root') {
    return treeData;
  }
  if (meta.parentType === 'ancestor') {
    return getRFamilyParentsData(treeData, meta, false);
  }
  if (meta.parentType === 'parent') {
    return getRFamilyParent(treeData, meta.parentIndex);
  }
  if (meta.parentType === 'child') {
    return getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
  }
  if (meta.parentType === 'grandchild') {
    return getRFamilyGrandchild(treeData, meta.parentIndex, meta.childIndex, meta.grandIndex);
  }
  return null;
}

function getMemberAtMeta(treeData, meta) {
  if (!meta) return null;

  if (looksLikeRFamilySchema(treeData)) {
    if (meta.type === 'root') {
      return extractMemberDataFromRecord(treeData, 'Grandparent');
    }
    if (meta.type === 'ancestor') {
      const parentsData = getRFamilyParentsData(treeData, meta, false);
      return extractMemberDataFromRecord(parentsData);
    }
    if (meta.type === 'spouse') {
      const container = getRFamilySpouseContainer(treeData, meta);
      if (!container) return null;
      const spouses = extractSpouses(container.spouse);
      const spouse = spouses[normalizeIndex(meta.spouseIndex)];
      return extractMemberDataFromRecord(spouse);
    }
    const target = getRFamilyTargetNode(treeData, meta);
    return extractMemberDataFromRecord(target);
  }

  if (meta.type === 'couple') {
    const target = getCoupleNodeByPath(treeData, meta.path || []);
    return extractMemberDataFromRecord(target);
  }
  if (meta.type === 'spouse' && meta.parentType === 'couple') {
    const primary = getCoupleNodeByPath(treeData, meta.path || []);
    if (!primary) return null;
    const spouses = extractSpouses(primary.spouse);
    const spouse = spouses[normalizeIndex(meta.spouseIndex)];
    return extractMemberDataFromRecord(spouse);
  }

  return null;
}

function applyMemberFields(record, memberData, nameField = 'name') {
  if (!record || typeof record !== 'object') return false;
  record[nameField] = memberData.name;
  record.image = memberData.image || '';
  record.birthday = memberData.birthday || '';
  if (Array.isArray(memberData.visited) && memberData.visited.length > 0) {
    record.visited = memberData.visited;
  } else {
    delete record.visited;
  }
  return true;
}

function applyMemberUpdateAtMeta(treeData, meta, memberData) {
  if (!meta) return false;

  if (looksLikeRFamilySchema(treeData)) {
    if (meta.type === 'root') {
      return applyMemberFields(treeData, memberData, 'Grandparent');
    }
    if (meta.type === 'ancestor') {
      const parentsData = getRFamilyParentsData(treeData, meta, false);
      if (!parentsData) return false;
      return applyMemberFields(parentsData, memberData);
    }
    if (meta.type === 'spouse') {
      const container = getRFamilySpouseContainer(treeData, meta);
      if (!container) return false;
      if (!Array.isArray(container.spouse)) {
        container.spouse = container.spouse ? [container.spouse] : [];
      }
      const spouseIndex = normalizeIndex(meta.spouseIndex);
      if (spouseIndex >= container.spouse.length) return false;
      const current = container.spouse[spouseIndex];
      const spouseRecord = (current && typeof current === 'object')
        ? current
        : { name: safeText(current) };
      applyMemberFields(spouseRecord, memberData);
      container.spouse[spouseIndex] = spouseRecord;
      return true;
    }
    const target = getRFamilyTargetNode(treeData, meta);
    if (!target || typeof target !== 'object') return false;
    return applyMemberFields(target, memberData);
  }

  if (meta.type === 'couple') {
    const target = getCoupleNodeByPath(treeData, meta.path || []);
    if (!target || typeof target !== 'object') return false;
    return applyMemberFields(target, memberData);
  }
  if (meta.type === 'spouse' && meta.parentType === 'couple') {
    const primary = getCoupleNodeByPath(treeData, meta.path || []);
    if (!primary) return false;
    if (!Array.isArray(primary.spouse)) {
      primary.spouse = primary.spouse ? [primary.spouse] : [];
    }
    const spouseIndex = normalizeIndex(meta.spouseIndex);
    if (spouseIndex >= primary.spouse.length) return false;
    const current = primary.spouse[spouseIndex];
    const spouseRecord = (current && typeof current === 'object')
      ? current
      : { name: safeText(current) };
    applyMemberFields(spouseRecord, memberData);
    primary.spouse[spouseIndex] = spouseRecord;
    return true;
  }

  return false;
}

function updateMemberAt(meta, memberData) {
  if (!meta || !memberData) return false;

  const jsonEditor = document.getElementById('jsonEditor');
  if (!jsonEditor) return false;

  let treeData;
  try {
    treeData = JSON.parse(jsonEditor.value || '{}');
  } catch (e) {
    alert('JSON is invalid. Fix it before editing members.');
    return false;
  }

  const updated = applyMemberUpdateAtMeta(treeData, meta, memberData);
  if (!updated) {
    alert('Could not save changes for this person.');
    return false;
  }

  jsonEditor.value = JSON.stringify(treeData, null, 2);
  markAsChanged();
  scheduleVisualRender(false);
  return true;
}

