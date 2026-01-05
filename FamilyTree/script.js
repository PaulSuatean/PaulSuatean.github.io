/*
  Family Tree renderer

  Data format (family.json):
  {
    "name": "Root Person",
    "spouse": "Spouse Name", // optional
    "meta": "(years, note)",  // optional small text
    "children": [ { ... same shape ... } ]
  }

  The code treats each node as a couple with optional spouse and children.
*/

(function () {
  const svg = d3.select('#tree');
  const g = svg.append('g').attr('class', 'viewport');
  const defs = svg.append('defs');
  // Modal refs
  const modalEl = document.getElementById('photoModal');
  const modalImg = document.getElementById('modalImg');
  const modalName = document.getElementById('modalTitle');
  const modalDob = document.getElementById('modalDob');
  const modalClose = document.getElementById('modalClose');

  const person = {
    width: 170,
    height: 120,
    hGap: 48, // gap between spouses (tripled)
  };
  const level = {
    vGap: 180, // vertical distance between generations (increased)
    hGap: 28,  // additional horizontal spacing
  };
  const baseCoupleWidth = person.width * 2 + person.hGap;
  const avatar = { r: 36, top: 10 };

  const placeholderDataUrl = 'data:image/svg+xml;utf8,' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" fill="%23d7dbe2"/>' +
    '<circle cx="32" cy="24" r="12" fill="%239aa3b2"/>' +
    '<rect x="16" y="38" width="32" height="16" rx="8" fill="%239aa3b2"/>' +
    '</svg>';

  // Zoom/Pan
  const zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  svg.call(zoom);

  // Controls
  let dnaOn = false;
  let dnaGroup = null; // overlay for DNA lines
  function updateDNAVisibility() {
    if (dnaGroup) dnaGroup.attr('display', dnaOn ? null : 'none');
    d3.select('#tree').classed('dna-active', dnaOn);
  }
  const dnaBtn = document.getElementById('dnaBtn');
  if (dnaBtn) {
    dnaBtn.addEventListener('click', () => {
      dnaOn = !dnaOn;
      updateDNAVisibility();
    });
  }
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    const savedTheme = localStorage.getItem('tree-theme');
    if (savedTheme === 'dark') document.body.classList.add('theme-dark');
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('theme-dark');
      localStorage.setItem('tree-theme', document.body.classList.contains('theme-dark') ? 'dark' : 'light');
    });
  }
  document.getElementById('zoomInBtn').addEventListener('click', () => smoothZoom(1.2));
  document.getElementById('zoomOutBtn').addEventListener('click', () => smoothZoom(1/1.2));
  document.getElementById('resetBtn').addEventListener('click', () => fitToScreen(50));

  function smoothZoom(factor) {
    svg.transition().duration(250).call(zoom.scaleBy, factor);
  }
  function resetView() {
    svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity);
  }
  function fitToScreen(padding = 40) {
    const bbox = g.node().getBBox();
    if (!isFinite(bbox.x) || !isFinite(bbox.y) || !isFinite(bbox.width) || !isFinite(bbox.height)) return;
    const w = svg.node().clientWidth;
    const h = svg.node().clientHeight;
    const scale = Math.min(
      (w - padding * 2) / Math.max(bbox.width, 1),
      (h - padding * 2) / Math.max(bbox.height, 1)
    );
    const tx = (w - bbox.width * scale) / 2 - bbox.x * scale;
    const ty = (h - bbox.height * scale) / 2 - bbox.y * scale;
    const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
    svg.transition().duration(450).call(zoom.transform, t);
  }

  // Modal helpers
  function openModal(info) {
    if (!modalEl) return;
    modalImg.src = info.image || '';
    modalName.textContent = info.name || '';
    if (info.birthday && String(info.birthday).trim() !== '') {
      modalDob.textContent = `Birthday: ${info.birthday}`;
      modalDob.style.display = '';
    } else {
      modalDob.textContent = '';
      modalDob.style.display = 'none';
    }
    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    modalImg.src = '';
  }
  if (modalEl) {
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }
  if (modalClose) modalClose.addEventListener('click', closeModal);

  // Load data from rfamily.json (try common relative locations)
  loadDataSequential(['rfamily.json', '../rfamily.json', '/rfamily.json'])
    .then((data) => render(normalizeData(data)))
    .catch((err) => {
      console.error('Failed to load data', err);
      g.append('text')
        .attr('x', 20)
        .attr('y', 30)
        .attr('fill', '#e66')
        .text('Failed to load family data');
    });

  function loadDataSequential(paths) {
    return new Promise((resolve, reject) => {
      const tryAt = (i) => {
        if (i >= paths.length) return reject(new Error('No data file found'));
        const url = paths[i] + (paths[i].includes('?') ? '' : ('?t=' + Date.now()));
        fetch(url, { cache: 'no-store' })
          .then((r) => { if (!r.ok) throw new Error('HTTP '+r.status + ' at ' + paths[i]); return r.json(); })
          .then(resolve)
          .catch(() => tryAt(i + 1));
      };
      tryAt(0);
    });
  }

  function looksLikeRFamilySchema(obj) {
    return obj && (obj.GreatGrandparent || obj.Parent || obj.Grandparent);
  }

  function normalizeData(input) {
    if (looksLikeRFamilySchema(input)) {
      return transformRFamily(input);
    }
    return input; // already couple-style
  }

  // Transform rfamily.json into a uniform couple tree (preserving image + gender)
  function transformRFamily(src) {
    const maternal = src.spouse && src.spouse.parents ? src.spouse.parents : null;
    const paternal = src.GreatGrandparent || {};
    const gg = {
      name: safe(paternal.name),
      image: safe(paternal.image),
      spouse: paternal.spouse ? { name: safe(paternal.spouse.name), image: safe(paternal.spouse.image) } : undefined,
      birthday: safe(paternal.birthday || paternal.dob)
    };
    const ggCouple = {
      name: safe(gg.name),
      image: safe(gg.image),
      birthday: safe(gg.birthday || gg.dob),
      spouse: safe(gg.spouse && gg.spouse.name),
      spouseImage: safe(gg.spouse && gg.spouse.image),
      spouseBirthday: safe(gg.spouse && (gg.spouse.birthday || gg.spouse.dob)),
      children: []
    };

    // Grandparents couple (child of Great-Grandparents)
    const grandparentName = safe(src.Grandparent);
    const grandparentSpouse = safe(src.spouse && src.spouse.name);
    const gpCouple = {
      name: grandparentName,
      image: safe(src.image),
      birthday: safe(src.birthday || src.dob),
      spouse: grandparentSpouse,
      spouseImage: safe(src.spouse && src.spouse.image),
      spouseBirthday: safe(src.spouse && (src.spouse.birthday || src.spouse.dob)),
      children: []
    };
    if (maternal && (safe(maternal.name) || (maternal.spouse && safe(maternal.spouse.name)))) {
      gpCouple.spouseParents = {
        name: safe(maternal.name),
        image: safe(maternal.image),
        birthday: safe(maternal.birthday || maternal.dob),
        spouse: maternal.spouse ? safe(maternal.spouse.name) : '',
        spouseImage: maternal.spouse ? safe(maternal.spouse.image) : '',
        spouseBirthday: maternal.spouse ? safe(maternal.spouse.birthday || maternal.spouse.dob) : ''
      };
    }
    if (grandparentName || grandparentSpouse) ggCouple.children.push(gpCouple);

    // Parents generation (children of Grandparents)
    const parents = Array.isArray(src.Parent) ? src.Parent : [];
    parents.forEach((p) => {
      const pc = {
        name: safe(p.name),
        image: safe(p.image),
        birthday: safe(p.birthday || p.dob),
        prevSpouse: (p.prevSpouse ? {
          name: safe(p.prevSpouse.name),
          image: safe(p.prevSpouse.image),
          birthday: safe(p.prevSpouse.birthday || p.prevSpouse.dob)
        } : undefined),
        spouse: safe(p.spouse && p.spouse.name),
        spouseImage: safe(p.spouse && p.spouse.image),
        spouseBirthday: safe(p.spouse && (p.spouse.birthday || p.spouse.dob)),
        children: []
      };
      gpCouple.children.push(pc);

      // Children generation (children of each Parent)
      const kids = Array.isArray(p.children) ? p.children : [];
      kids.forEach((k) => {
        const kc = {
          name: safe(k.name),
          image: safe(k.image),
          birthday: safe(k.birthday || k.dob),
          spouse: safe(k.spouse && k.spouse.name),
          spouseImage: safe(k.spouse && k.spouse.image),
          spouseBirthday: safe(k.spouse && (k.spouse.birthday || k.spouse.dob)),
          children: [],
          fromPrevSpouse: !!k.fromPrevSpouse
        };
        pc.children.push(kc);

        // Grandchildren (great-grandkids relative to the root)
        const gk = Array.isArray(k.grandchildren) ? k.grandchildren : [];
        gk.forEach((gchild) => {
          kc.children.push({
            name: safe(gchild.name),
            image: safe(gchild.image),
            birthday: safe(gchild.birthday || gchild.dob)
          });
        });
      });

      // Support simpler case where Parent lists immediate children as strings.
      if (Array.isArray(p.childrenStrings)) {
        p.childrenStrings.forEach((nm) => pc.children.push({ name: safe(nm) }));
      }
    });

    return ggCouple;
  }

  function safe(v) { return (v == null ? '' : String(v)); }

  function asHierarchy(data) {
    // Treat each entry as a "couple" node with optional spouse
    return d3.hierarchy(data, (d) => d.children || []);
  }

  function render(data) {
    g.selectAll('*').remove();

    const root = asHierarchy(data);

    // Top-to-bottom layout: x = horizontal, y = vertical
    const tree = d3.tree()
      .nodeSize([baseCoupleWidth, person.height + level.vGap])
      .separation((a, b) => {
        const gap = Math.max(16, person.width * 0.35); // even tighter horizontal spacing
        const needed = (nodeWidth(a) / 2) + gap + (nodeWidth(b) / 2);
        const base = needed / baseCoupleWidth;
        return a.parent === b.parent ? base : base * 1.4; // different families a bit farther
      });

    tree(root);

    // Connector geometry (split directly below the marriage line for continuity)
    const splitPad = 18;
    function layoutFor(data) {
      const hasLeft = !!(data.prevSpouse && ((data.prevSpouse.name && String(data.prevSpouse.name).trim() !== '') || data.prevSpouse.image));
      const hasRight = typeof data.spouse === 'string' && data.spouse.trim() !== '';
      const count = 1 + (hasLeft ? 1 : 0) + (hasRight ? 1 : 0);
      const totalWidth = person.width * count + person.hGap * (count - 1);
      const leftStart = -totalWidth / 2;
      const xPrimary = leftStart + (hasLeft ? (person.width + person.hGap) : 0);
      const xLeftSpouse = hasLeft ? leftStart : null;
      const xRightSpouse = hasRight ? (xPrimary + person.width + person.hGap) : null;
      return { hasLeft, hasRight, count, totalWidth, leftStart, xPrimary, xLeftSpouse, xRightSpouse };
    }
    function topOfPrimary(node) {
      const L = layoutFor(node.data);
      return { x: node.x + L.xPrimary + person.width / 2, y: node.y - person.height / 2 };
    }
    function bottomOfPrimary(node) {
      const L = layoutFor(node.data);
      return { x: node.x + L.xPrimary + person.width / 2, y: node.y + person.height / 2 };
    }
    function bottomOfLeftSpouse(node) {
      const L = layoutFor(node.data);
      if (!L.hasLeft) return null;
      return { x: node.x + L.xLeftSpouse + person.width / 2, y: node.y + person.height / 2 };
    }
    function bottomOfRightSpouse(node) {
      const L = layoutFor(node.data);
      if (!L.hasRight) return null;
      return { x: node.x + L.xRightSpouse + person.width / 2, y: node.y + person.height / 2 };
    }
    function topOfRightSpouse(node) {
      const L = layoutFor(node.data);
      if (!L.hasRight) return null;
      return { x: node.x + L.xRightSpouse + person.width / 2, y: node.y - person.height / 2 };
    }
    function exitFromMarriage(node) { return { x: node.x, y: node.y }; }
    function marriageLeftPoint(node) {
      const L = layoutFor(node.data);
      return { x: node.x + L.xPrimary, y: node.y };
    }
    function junctionBelow(node) { return { x: node.x, y: node.y + (person.height / 2) + splitPad }; }

    // How far below the bubbles the two parent-curves meet
    const mergePad = Math.max(24, person.height * 0.35);
    const mergeCurves = [];
    const mergeCurvesGold = [];
    const trunkCommon = [];
    const branches = [];
    const overlayCouples = [];

    function addOverlayCouple(info, placementAnchor, childAnchor) {
      if (!info || !placementAnchor || !childAnchor) return;
      const data = {
        name: safe(info.name),
        image: safe(info.image),
        birthday: safe(info.birthday),
        spouse: safe(info.spouse),
        spouseImage: safe(info.spouseImage),
        spouseBirthday: safe(info.spouseBirthday)
      };
      if (!data.name && !data.spouse) return;
      const layout = layoutFor(data);
      const centerX = placementAnchor.x + (person.width / 2) + (person.hGap / 2);
      const unionX = centerX;
      const center = {
        x: centerX,
        y: placementAnchor.y + (person.height / 2)
      };
      const primaryInterior = {
        x: centerX + layout.xPrimary + person.width,
        y: center.y
      };
      const spouseInterior = layout.hasRight ? {
        x: centerX + layout.xRightSpouse,
        y: center.y
      } : null;
      const mergeTarget = { x: unionX, y: center.y + mergePad };
      mergeCurves.push({ source: primaryInterior, target: mergeTarget });
      mergeCurvesGold.push({ source: primaryInterior, target: mergeTarget });
      if (spouseInterior) {
        mergeCurves.push({ source: spouseInterior, target: mergeTarget });
      }
      const childPoint = { x: unionX, y: childAnchor.y };
      trunkCommon.push({ x: unionX, y0: mergeTarget.y, y1: childPoint.y });
      branches.push({ source: mergeTarget, target: childPoint });
      overlayCouples.push({ center, layout, data });
    }
    root.descendants().forEach((p) => {
      if (p.data && p.data.spouseParents) {
        const childAnchor = topOfRightSpouse(p);
        const placementAnchor = p.parent ? topOfRightSpouse(p.parent) || childAnchor : childAnchor;
        addOverlayCouple(p.data.spouseParents, placementAnchor, childAnchor);
      }
      if (!Array.isArray(p.children) || p.children.length === 0) return;
      const Lp = layoutFor(p.data || {});
      // Start curves at the interior sides (center-right/center-left) of the parent bubbles
      const yCenter = p.y; // bubble vertical center in absolute coords
      const yMerge = yCenter + mergePad;
      const yJ = junctionBelow(p).y;
      const anchors = [];
      let hasLeftChild = false, hasRightChild = false;
      p.children.forEach((c) => {
        if (c.data && c.data.fromPrevSpouse) hasLeftChild = true; else hasRightChild = true;
      });
      // Interior anchors on the sides facing inward
      const Lpi = layoutFor(p.data || {});
      const anchorPrimaryLeft  = { x: p.x + Lpi.xPrimary,              y: yCenter };
      const anchorPrimaryRight = { x: p.x + Lpi.xPrimary + person.width, y: yCenter };
      const anchorLeftSpouseRight = Lpi.hasLeft  ? { x: p.x + Lpi.xLeftSpouse  + person.width, y: yCenter } : null;
      const anchorRightSpouseLeft = Lpi.hasRight ? { x: p.x + Lpi.xRightSpouse,               y: yCenter } : null;
      // Build LEFT union
      if (Lp.hasLeft && hasLeftChild && anchorLeftSpouseRight) {
        const xMergeLeft = (anchorLeftSpouseRight.x + anchorPrimaryLeft.x) / 2;
        const tLeft = { x: xMergeLeft, y: yMerge };
        mergeCurves.push({ source: anchorLeftSpouseRight, target: tLeft });
        mergeCurves.push({ source: anchorPrimaryLeft,     target: tLeft });
        mergeCurvesGold.push({ source: anchorPrimaryLeft, target: tLeft });
        trunkCommon.push({ x: xMergeLeft, y0: yMerge, y1: yJ });
        const jLeft = { x: xMergeLeft, y: yJ };
        p.children.forEach((c) => {
          if (c.data && c.data.fromPrevSpouse) {
            branches.push({ source: jLeft, target: topOfPrimary(c), parent: p, child: c });
          }
        });
      }
      // Build RIGHT union
      if (Lp.hasRight && hasRightChild && anchorRightSpouseLeft) {
        const xMergeRight = (anchorPrimaryRight.x + anchorRightSpouseLeft.x) / 2;
        const tRight = { x: xMergeRight, y: yMerge };
        mergeCurves.push({ source: anchorPrimaryRight,    target: tRight });
        mergeCurves.push({ source: anchorRightSpouseLeft, target: tRight });
        mergeCurvesGold.push({ source: anchorPrimaryRight, target: tRight });
        trunkCommon.push({ x: xMergeRight, y0: yMerge, y1: yJ });
        const jRight = { x: xMergeRight, y: yJ };
        p.children.forEach((c) => {
          if (!(c.data && c.data.fromPrevSpouse)) {
            branches.push({ source: jRight, target: topOfPrimary(c), parent: p, child: c });
          }
        });
      }
    });
    const linkGen = d3.linkVertical().x((d) => d.x).y((d) => d.y);
    // Custom smoother curve for union connectors (more natural than default)
    function unionCurvePath(d){
      const x0 = d.source.x, y0 = d.source.y;
      const x1 = d.target.x, y1 = d.target.y;
      const dx = x1 - x0;
      const dir = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
      const lead = Math.max(12, Math.min(30, Math.abs(dx) * 0.33)); // shorter horizontal start (previous)
      const dy = Math.max(30, y1 - y0);
      const c1x = x0 + dir * lead; // start horizontally
      const c1y = y0;
      const c2x = x1;              // arrive smoothly to target
      const c2y = y1 - dy * 0.6;
      return `M ${x0},${y0} C ${c1x},${c1y} ${c2x},${c2y} ${x1},${y1}`;
    }
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .selectAll('path.curve')
      .data(mergeCurves)
      .join('path')
      .attr('class', 'link')
      .attr('d', (d) => unionCurvePath(d));
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .selectAll('path.trunk')
      .data(trunkCommon)
      .join('path')
      .attr('class', 'link trunk')
      .attr('d', (t) => `M ${t.x},${t.y0} V ${t.y1}`);
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .selectAll('path.branch')
      .data(branches)
      .join('path')
      .attr('class', 'link branch')
      .attr('d', (d) => linkGen(d));

    // Bloodline highlight (male lineage): highlight links where the child (primary person) is male
    function isMaleNode(node) {
      const g = (node.data && node.data.gender) ? String(node.data.gender).toUpperCase() : '';
      if (g === 'M' || g === 'MALE') return true;
      if (g === 'F' || g === 'FEMALE') return false;
      const s = (node.data && node.data.name ? String(node.data.name) : '').trim();
      if (!s) return false;
      const lower = s.toLowerCase();
      const femaleList = ['elena','ana','maria','simona','corina','sonia','olivia','damaris','csilla','susana','andrea','andra','felicia'];
      if (/[aăâ]$/.test(lower) || femaleList.includes(lower)) return false;
      return true;
    }
    const bloodLinks = branches;
    g.append('g')
      .attr('display', 'none')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .selectAll('path.blood-link')
      .data(bloodLinks)
      .join('path')
      .attr('class', 'blood-link')
      .attr('d', (d) => linkGen(d));

    // Couples
    const couples = g.append('g')
      .selectAll('g.couple')
      .data(root.descendants())
      .join('g')
      .attr('class', 'couple')
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    couples.each(function (d) {
      const L = layoutFor(d.data);
      const group = d3.select(this);

      // marriage connector line(s) removed in favor of curved union lines

      // Primary
      drawPerson(group, {
        x: L.xPrimary,
        y: -person.height / 2,
        name: d.data.name,
        meta: '',
        image: d.data.image,
        birthday: d.data.birthday,
        role: 'primary'
      });

      // Left spouse
      if (L.hasLeft) {
        const ps = d.data.prevSpouse || {};
        drawPerson(group, {
          x: L.xLeftSpouse,
          y: -person.height / 2,
          name: ps.name,
          meta: '',
          image: ps.image,
          birthday: ps.birthday,
          role: 'spouse'
        });
      }

      // Right spouse
      if (L.hasRight) {
        drawPerson(group, {
          x: L.xRightSpouse,
          y: -person.height / 2,
          name: d.data.spouse,
          meta: '',
          image: d.data.spouseImage,
          birthday: d.data.spouseBirthday,
          role: 'spouse'
        });
      }
    });

    if (overlayCouples.length) {
      const overlayGroup = g.append('g')
        .selectAll('g.couple.overlay')
        .data(overlayCouples)
        .join('g')
        .attr('class', 'couple overlay')
        .attr('transform', (d) => `translate(${d.center.x},${d.center.y})`);

      overlayGroup.each(function (d) {
        const group = d3.select(this);
        const L = d.layout;

        drawPerson(group, {
          x: L.xPrimary,
          y: -person.height / 2,
          name: d.data.name,
          image: d.data.image,
          birthday: d.data.birthday,
          role: 'primary'
        });

        if (L.hasRight) {
          drawPerson(group, {
            x: L.xRightSpouse,
            y: -person.height / 2,
            name: d.data.spouse,
            image: d.data.spouseImage,
            birthday: d.data.spouseBirthday,
            role: 'spouse'
          });
        }
      });
    }

    // Overlay connectors on top for visual continuity (dark)
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .selectAll('path.curve-top')
      .data(mergeCurves)
      .join('path')
      .attr('class', 'link')
      .attr('d', (d) => unionCurvePath(d));

    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .selectAll('path.trunk-top')
      .data(trunkCommon)
      .join('path')
      .attr('class', 'link trunk')
      .attr('d', (t) => `M ${t.x},${t.y0} V ${t.y1}`);

    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .selectAll('path.branch-top')
      .data(branches)
      .join('path')
      .attr('class', 'link branch')
      .attr('d', (d) => linkGen(d));

    // DNA overlay group (gold) with toggle — show full T via DNA parent only
    const dnaBranches = branches;
    dnaGroup = g.append('g');

    // Curved union segments (gold) only for DNA parent (primary)
    dnaGroup.selectAll('path.blood-curve')
      .data(mergeCurvesGold)
      .join('path')
      .attr('class', 'blood-link')
      .attr('d', (d) => unionCurvePath(d));

    // Single vertical trunk (gold)
    dnaGroup.selectAll('path.blood-trunk')
      .data(trunkCommon)
      .join('path')
      .attr('class', 'blood-link')
      .attr('d', (t) => `M ${t.x},${t.y0} V ${t.y1}`);

    // Split -> child bubble top (gold curved branches)
    dnaGroup.selectAll('path.blood-branch')
      .data(dnaBranches)
      .join('path')
      .attr('class', 'blood-link')
      .attr('d', (d) => linkGen(d));
    updateDNAVisibility();

    fitToScreen(50);
  }

  function drawPerson(sel, opts) {
    const classes = ['person'];
    if (opts.role) classes.push(opts.role);
    const gPerson = sel.append('g').attr('class', classes.join(' ')).attr('transform', `translate(${opts.x},${opts.y})`);

    gPerson.append('rect')
      .attr('width', person.width)
      .attr('height', person.height)
      .attr('rx', 12).attr('ry', 12);

    // Avatar (image clipped to a circle) centered above the name
    const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;
    const cp = defs.append('clipPath').attr('id', clipId);
    cp.append('circle').attr('cx', 0).attr('cy', 0).attr('r', avatar.r);

    const cx = person.width / 2;
    const cy = avatar.top + avatar.r;
    const gAvatar = gPerson.append('g').attr('transform', `translate(${cx},${cy})`);
    gAvatar.append('image')
      .attr('href', opts.image || placeholderDataUrl)
      .attr('x', -avatar.r)
      .attr('y', -avatar.r)
      .attr('width', avatar.r * 2)
      .attr('height', avatar.r * 2)
      .attr('clip-path', `url(#${clipId})`)
      .attr('preserveAspectRatio', 'xMidYMid slice');

    // Name centered, below the avatar
    gPerson.append('text')
      .attr('class', 'name')
      .attr('x', person.width / 2)
      .attr('y', avatar.top + avatar.r * 2 + 22)
      .attr('text-anchor', 'middle')
      .text(opts.name || '');

    gPerson.on('click', () => {
      openModal({ name: opts.name, image: opts.image || placeholderDataUrl, birthday: opts.birthday });
    });
  }

  function hasSpouseData(d) {
    const data = d?.data || {};
    const right = typeof data.spouse === 'string' && data.spouse.trim() !== '';
    const left = !!(data.prevSpouse && ((data.prevSpouse.name && String(data.prevSpouse.name).trim() !== '') || data.prevSpouse.image));
    return right || left;
  }
  function nodeWidth(d) {
    const data = d?.data || {};
    const right = typeof data.spouse === 'string' && data.spouse.trim() !== '';
    const left = !!(data.prevSpouse && ((data.prevSpouse.name && String(data.prevSpouse.name).trim() !== '') || data.prevSpouse.image));
    const count = 1 + (right ? 1 : 0) + (left ? 1 : 0);
    return person.width * count + person.hGap * (count - 1);
  }

  function styleForGender(gender) {
    const g = (gender || '').toUpperCase();
    if (g === 'F' || g === 'FEMALE') {
      return { fill: getCssVar('--female') || '#ffd1dc', stroke: '#e29cb0' };
    }
    if (g === 'M' || g === 'MALE') {
      return { fill: getCssVar('--male') || '#bfe7ff', stroke: '#8dbfdd' };
    }
    return { fill: '#dde3ee', stroke: '#a6b0c2' };
  }
  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function normalizeGender(v) {
    if (!v) return '';
    const s = String(v).trim().toUpperCase();
    if (s.startsWith('M')) return 'M';
    if (s.startsWith('F')) return 'F';
    return '';
  }
  function guessGender(name, isSpouse) {
    const s = (name || '').trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    if (/[aăâ]$/.test(lower) || ['elena','ana','maria','simona','corina','sonia','olivia','damaris','csilla','susana'].includes(lower)) return 'F';
    if (isSpouse) return 'F';
    return 'M';
  }
})();
