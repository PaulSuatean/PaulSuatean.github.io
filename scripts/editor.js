// Editor Logic

let currentUser = null;
let currentTree = null;
let treeId = null;
let hasUnsavedChanges = false;
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
let pendingDeleteMeta = null;
let visitedCountries = [];

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
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
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
      return;
    }
    
    // Clean up any duplicate nodes before saving
    treeData = cleanupTreeData(treeData);
    
    // Get updated values
    const name = document.getElementById('editTreeName').value.trim();
    const description = document.getElementById('editTreeDescription').value.trim();
    const privacy = document.getElementById('editTreePrivacy').value;
    
    if (!name) {
      alert('Tree name is required');
      return;
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
      textNode.textContent = ' ✓ Saved!';
      setTimeout(() => {
        textNode.textContent = originalText;
      }, 2000);
    } else {
      saveBtn.textContent = '✓ Saved!';
      setTimeout(() => {
        saveBtn.textContent = originalText;
      }, 2000);
    }
  } catch (error) {
    console.error('Error saving tree:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    alert('Failed to save tree: ' + (error.message || 'Please try again.'));
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
  const spacing = { x: 28, y: 180 };
  const maxSpouseCount = getMaxSpouseCount(treeData);
  const spouseSlots = Math.max(1, maxSpouseCount);
  const coupleWidth = person.width * (1 + spouseSlots) + person.spouseGap * spouseSlots;
  const nodeSize = { width: person.width, height: person.height };
  const layout = d3.tree().nodeSize([coupleWidth + spacing.x, nodeSize.height + spacing.y]);
  const root = d3.hierarchy(treeData);
  layout(root);

  const nodes = root.descendants();
  const links = root.links();

  const spouseNodes = [];
  const spouseByPrimaryId = new Map();
  const primaryById = new Map();
  nodes.forEach((node) => primaryById.set(node.data.id, node));
  const getCoupleGroupWidth = (spouseCount) => {
    if (!spouseCount) return person.width;
    return person.width * (1 + spouseCount) + person.spouseGap * spouseCount;
  };

  nodes.forEach((node) => {
    const spouses = node.data.spouses || [];
    if (!spouses.length) return;
    if (!node.data.meta) return;

    const parentType = node.data.meta.type || '';
    const groupWidth = getCoupleGroupWidth(spouses.length);
    const primaryCenterX = node.x - groupWidth / 2 + person.width / 2;
    spouses.forEach((spouse, spouseIndex) => {
      const spouseName = safeText(spouse.name || spouse);
      if (!spouseName) return;

      const spouseMeta = {
        type: 'spouse',
        parentType,
        parentIndex: node.data.meta.parentIndex,
        childIndex: node.data.meta.childIndex,
        grandIndex: node.data.meta.grandIndex,
        targetType: node.data.meta.targetType,
        spouseIndex
      };

      if (parentType === 'couple') {
        spouseMeta.addable = false;
      }

      const spouseNode = {
        x: primaryCenterX + (person.width + person.spouseGap) * (spouseIndex + 1),
        y: node.y,
        data: {
          id: `${node.data.id}-spouse-${spouseIndex}`,
          label: spouseName,
          image: spouse.image || '',
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
  const spouseLinkGen = d3.linkHorizontal()
    .x((d) => d.x)
    .y((d) => d.y);
  const spouseLinks = spouseNodes.map((spouseNode) => {
    const primaryId = spouseNode.data.id.replace(/-spouse-\d+$/, '');
    return { source: primaryById.get(primaryId), target: spouseNode };
  }).filter((link) => !!link.source);
  const getPrimaryCardCenterX = (node) => {
    const spouses = node.data.spouses || [];
    const groupWidth = getCoupleGroupWidth(spouses.length);
    return node.x - groupWidth / 2 + person.width / 2;
  };
  const getDrawX = (node) => {
    if (node.data.meta && node.data.meta.type === 'spouse') {
      return node.x;
    }
    return getPrimaryCardCenterX(node);
  };
  const linkSourcePoint = (node) => ({ x: node.x, y: node.y + nodeSize.height / 2 });

  const linkSel = visualState.g.selectAll('.link')
    .data(links, (d) => `${d.source.data.id}-${d.target.data.id}`);
  linkSel.exit().remove();
  linkSel.enter()
    .append('path')
    .attr('class', 'link')
    .merge(linkSel)
    .attr('d', (d) => linkGen({
      source: linkSourcePoint(d.source),
      target: { x: d.target.x, y: d.target.y - nodeSize.height / 2 }
    }));

  const spouseLinkSel = visualState.g.selectAll('.spouse-link')
    .data(spouseLinks, (d) => `${d.source.data.id}-${d.target.data.id}`);
  spouseLinkSel.exit().remove();
  spouseLinkSel.enter()
    .append('path')
    .attr('class', 'link spouse-link')
    .merge(spouseLinkSel)
    .attr('d', (d) => spouseLinkGen({
      source: { x: getPrimaryCardCenterX(d.source) + nodeSize.width / 2, y: d.target.y },
      target: { x: d.target.x - nodeSize.width / 2, y: d.target.y }
    }));

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
  mergedNodes.attr('transform', (d) => {
    const drawX = getDrawX(d);
    d._drawX = drawX;
    return `translate(${drawX - nodeSize.width / 2}, ${d.y - nodeSize.height / 2})`;
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
  if (looksLikeRFamilySchema(data)) {
    return buildRFamilyTree(data);
  }
  if (data.name || data.spouse || Array.isArray(data.children)) {
    return buildCoupleTree(data, []);
  }
  return null;
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
    const parentNode = {
      id: `p-${parentIndex}`,
      label: formatCoupleLabel(p.name, null),
      image: p.image || '',
      spouses: parentSpouses,
      meta: { type: 'parent', parentIndex },
      children: []
    };
    
    const kids = Array.isArray(p.children) ? p.children : [];
    kids.forEach((k, childIndex) => {
      const childSpouses = extractSpouses(k.spouse);
      const childNode = {
        id: `c-${parentIndex}-${childIndex}`,
        label: formatCoupleLabel(k.name, null),
        image: k.image || '',
        spouses: childSpouses,
        meta: { type: 'child', parentIndex, childIndex },
        children: []
      };
      
      const grandkids = Array.isArray(k.grandchildren) ? k.grandchildren : [];
      grandkids.forEach((g, grandIndex) => {
        const grandNode = {
          id: `g-${parentIndex}-${childIndex}-${grandIndex}`,
          label: safeText(g.name) || 'Member',
          image: g.image || '',
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

function buildCoupleTree(node, path) {
  const label = formatCoupleLabel(node.name, node.spouse);
  const children = Array.isArray(node.children) ? node.children : [];
  const spouses = node.spouses || extractSpouses(node.spouse);
  return {
    id: `n-${path.join('-') || 'root'}`,
    label: label || 'Member',
    image: node.image || '',
    spouses: spouses,
    meta: { type: 'couple', path: path.slice() },
    children: children.map((child, index) => buildCoupleTree(child, path.concat(index)))
  };
}

function getMaxSpouseCount(node) {
  if (!node || typeof node !== 'object') return 0;
  const spouses = Array.isArray(node.spouses) ? node.spouses : [];
  let max = spouses.length;
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child) => {
    const childMax = getMaxSpouseCount(child);
    if (childMax > max) max = childMax;
  });
  return max;
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
  
  // Add optional fields if provided
  if (memberData?.veteran !== undefined) {
    newMember.veteran = memberData.veteran;
  }
  if (memberData?.homeCountry) {
    newMember.homeCountry = memberData.homeCountry;
  }
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
        if (!Array.isArray(parent.children)) parent.children = [];
        parent.children.push(newMember);
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
          if (!Array.isArray(parent.children)) parent.children = [];
          parent.children.push(newMember);
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
        if (parentType === 'root') {
          if (!Array.isArray(treeData.Parent)) {
            treeData.Parent = treeData.Parent ? [treeData.Parent] : [];
          }
          treeData.Parent.push(newMember);
        } else if (parentType === 'parent') {
          const parent = getRFamilyParent(treeData, meta.parentIndex);
          if (!parent) return;
          if (!Array.isArray(parent.children)) parent.children = [];
          parent.children.push(newMember);
        } else if (parentType === 'child') {
          const child = getRFamilyChild(treeData, meta.parentIndex, meta.childIndex);
          if (!child) return;
          if (!Array.isArray(child.grandchildren)) child.grandchildren = [];
          child.grandchildren.push(newMember);
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

function getRFamilyChild(treeData, parentIndex, childIndex) {
  const parent = getRFamilyParent(treeData, parentIndex);
  if (!parent || !Array.isArray(parent.children)) return null;
  return parent.children[childIndex] || null;
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
      if (parent && Array.isArray(parent.children)) {
        parent.children.splice(meta.childIndex, 1);
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

// ============ ADD MEMBER POPUP & MODAL ============

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
  document.getElementById('confirmAddMember')?.addEventListener('click', confirmAddMember);

  // Photo upload
  const photoPreview = document.getElementById('photoUploadPreview');
  const photoInput = document.getElementById('memberPhotoInput');
  
  photoPreview?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', handleMemberPhotoSelect);

  // Additional section toggle
  document.getElementById('additionalToggle')?.addEventListener('click', toggleAdditionalFields);

  // Veteran toggle
  document.getElementById('veteranToggle')?.addEventListener('click', function() {
    this.classList.toggle('active');
  });

  // Visited countries tags
  const visitedInput = document.getElementById('visitedInput');
  visitedInput?.addEventListener('keydown', handleVisitedTagInput);

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
    // Remove active class from the + button
    document.querySelectorAll('.node-add.active').forEach(btn => {
      d3.select(btn).classed('active', false);
    });
  }
  // Don't clear pendingAddMemberMeta here - we still need it for the modal form!
}

function showAddMemberModal(relation) {
  const modal = document.getElementById('addMemberModal');
  const title = document.getElementById('addMemberTitle');
  
  if (!modal) return;

  // Set title based on relation
  const titles = {
    parent: 'Add Parent',
    spouse: 'Add Spouse',
    child: 'Add Child'
  };
  title.textContent = titles[relation] || 'Add Family Member';

  // Reset form
  resetAddMemberForm();

  // Show modal with animation
  modal.classList.add('show');
}

function hideAddMemberModal() {
  const modal = document.getElementById('addMemberModal');
  if (modal) {
    modal.classList.remove('show');
  }
  pendingAddMemberMeta = null;
  pendingAddRelation = null;
}

function resetAddMemberForm() {
  // Clear text inputs
  document.getElementById('memberFirstName').value = '';
  document.getElementById('memberLastName').value = '';
  document.getElementById('memberBirthday').value = '';
  document.getElementById('memberCountry').value = '';
  
  // Reset photo
  const photoPreview = document.getElementById('photoUploadPreview');
  const photoImg = document.getElementById('photoPreviewImg');
  const photoIcon = photoPreview?.querySelector('.material-symbols-outlined');
  if (photoImg) {
    photoImg.style.display = 'none';
    photoImg.src = '';
  }
  if (photoIcon) {
    photoIcon.style.display = 'block';
  }
  if (document.getElementById('memberPhotoInput')) {
    document.getElementById('memberPhotoInput').value = '';
  }

  // Reset veteran toggle
  document.getElementById('veteranToggle')?.classList.remove('active');

  // Clear visited countries
  visitedCountries = [];
  renderVisitedTags();

  // Collapse additional fields
  document.getElementById('additionalToggle')?.classList.remove('expanded');
  document.getElementById('additionalFields')?.classList.remove('show');
}

function handleMemberPhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const photoImg = document.getElementById('photoPreviewImg');
    const photoIcon = document.getElementById('photoUploadPreview')?.querySelector('.material-symbols-outlined');
    
    if (photoImg) {
      photoImg.src = e.target.result;
      photoImg.style.display = 'block';
    }
    if (photoIcon) {
      photoIcon.style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
}

function toggleAdditionalFields() {
  const toggle = document.getElementById('additionalToggle');
  const fields = document.getElementById('additionalFields');
  
  toggle?.classList.toggle('expanded');
  fields?.classList.toggle('show');
}

function handleVisitedTagInput(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const input = event.target;
    const value = input.value.trim();
    
    if (value && !visitedCountries.includes(value)) {
      visitedCountries.push(value);
      renderVisitedTags();
    }
    input.value = '';
  }
}

function renderVisitedTags() {
  const container = document.getElementById('visitedContainer');
  const input = document.getElementById('visitedInput');
  if (!container || !input) return;

  // Remove existing tags
  container.querySelectorAll('.tag').forEach(tag => tag.remove());

  // Add tags before input
  visitedCountries.forEach((country, index) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${country}<span class="tag-remove" data-index="${index}">&times;</span>`;
    container.insertBefore(tag, input);
  });

  // Add click handlers for remove buttons
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      visitedCountries.splice(index, 1);
      renderVisitedTags();
    });
  });
}

function confirmAddMember() {
  const firstNameEl = document.getElementById('memberFirstName');
  const lastNameEl = document.getElementById('memberLastName');
  
  if (!firstNameEl || !lastNameEl) {
    alert('Error: Form elements not found');
    return;
  }
  
  const firstName = firstNameEl.value.trim();
  const lastName = lastNameEl.value.trim();
  
  // Validate required fields
  if (!firstName || !lastName) {
    alert('Please fill in both First Name and Last Name');
    return;
  }

  // Gather all form data
  const photoElement = document.getElementById('photoPreviewImg');
  const birthdayElement = document.getElementById('memberBirthday');
  const countryElement = document.getElementById('memberCountry');
  const veteranElement = document.getElementById('veteranToggle');
  
  const memberData = {
    name: `${firstName} ${lastName}`,
    image: photoElement?.src || '',
    birthday: birthdayElement?.value.trim() || '',
    veteran: veteranElement?.classList.contains('active') || false,
    homeCountry: countryElement?.value.trim() || '',
    visited: [...visitedCountries]
  };

  // Don't include empty image data URL placeholder
  if (memberData.image && !memberData.image.startsWith('data:image')) {
    memberData.image = '';
  }

  // Add the member based on relation and meta
  if (pendingAddMemberMeta) {
    // Include the relation type in the meta
    const metaWithRelation = { ...pendingAddMemberMeta, relation: pendingAddRelation };
    addMemberAt(metaWithRelation, memberData);
  } else {
    alert('Error: Could not determine where to add member');
  }

  hideAddMemberModal();
}
