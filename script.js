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
  // Transparent hit-surface so every touch/pointer reaches the zoom handler
  const hitRect = svg.insert('rect', ':first-child')
    .attr('class', 'zoom-hit-surface')
    .attr('fill', 'transparent')
    .attr('pointer-events', 'all');
  function resizeHitSurface() {
    const { width, height } = svg.node().getBoundingClientRect();
    hitRect.attr('width', width).attr('height', height);
  }
  resizeHitSurface();
  window.addEventListener('resize', resizeHitSurface);
  // Modal refs
  const modalEl = document.getElementById('photoModal');
  const modalImg = document.getElementById('modalImg');
  const modalName = document.getElementById('modalTitle');
  const modalDob = document.getElementById('modalDob');
  const modalClose = document.getElementById('modalClose');
  const birthdayMonthsEl = document.getElementById('birthdayMonths');
  const calendarSection = document.getElementById('birthdaySection');
  const calendarToggle = document.getElementById('calendarToggle');
  const upcomingBanner = document.getElementById('upcomingBanner');
  const monthPrevBtn = document.getElementById('monthPrev');
  const monthNextBtn = document.getElementById('monthNext');
  const carouselControls = document.querySelector('.carousel-controls');
  const calendarSidePrev = document.getElementById('calendarSidePrev');
  const calendarSideNext = document.getElementById('calendarSideNext');
  const calendarSideNav = document.querySelector('.calendar-side-nav');
  let calendarOpen = false;
  const birthdayTooltip = document.getElementById('birthdayTooltip');
  const personLookup = new Map();
  let activeTooltipCell = null;
  let mobileMonthIndex = 0;
  const mobileQuery = window.matchMedia('(max-width: 640px)');
  let mobileShowAll = false;
  let touchStartX = null;
  let applyMobileState = null;

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
  const monthsMeta = [
    { short: 'Ian', long: 'Ianuarie' },
    { short: 'Feb', long: 'Februarie' },
    { short: 'Mar', long: 'Martie' },
    { short: 'Apr', long: 'Aprilie' },
    { short: 'Mai', long: 'Mai' },
    { short: 'Iun', long: 'Iunie' },
    { short: 'Iul', long: 'Iulie' },
    { short: 'Aug', long: 'August' },
    { short: 'Sep', long: 'Septembrie' },
    { short: 'Oct', long: 'Octombrie' },
    { short: 'Noi', long: 'Noiembrie' },
    { short: 'Dec', long: 'Decembrie' }
  ];

  const placeholderDataUrl = 'data:image/svg+xml;utf8,' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" fill="%23d7dbe2"/>' +
    '<circle cx="32" cy="24" r="12" fill="%239aa3b2"/>' +
    '<rect x="16" y="38" width="32" height="16" rx="8" fill="%239aa3b2"/>' +
    '</svg>';

  // Zoom/Pan
  let zoomEndTimer = null;
  function setZooming(active) {
    if (!document.body) return;
    if (active) {
      if (zoomEndTimer) {
        clearTimeout(zoomEndTimer);
        zoomEndTimer = null;
      }
      document.body.classList.add('is-zooming');
      return;
    }
    if (zoomEndTimer) clearTimeout(zoomEndTimer);
    zoomEndTimer = setTimeout(() => {
      document.body.classList.remove('is-zooming');
      zoomEndTimer = null;
    }, 140);
  }
  const zoom = d3.zoom()
    .scaleExtent([0.02, 6])
    .wheelDelta((event) => {
      const base = event.deltaMode === 1 ? 0.02 : 0.002; // lines vs pixels
      return -event.deltaY * base;
    })
    .on('start', () => setZooming(true))
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    })
    .on('end', () => setZooming(false));
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
  let autoThemeTimer = null;
  if (themeBtn) {
    const savedTheme = localStorage.getItem('tree-theme');
    const initialTheme = resolveInitialTheme(savedTheme);
    document.body.classList.toggle('theme-dark', initialTheme === 'dark');
    updateThemeIcon();

    if (!savedTheme) {
      autoThemeTimer = setInterval(() => {
        if (localStorage.getItem('tree-theme')) {
          clearInterval(autoThemeTimer);
          autoThemeTimer = null;
          return;
        }
        const desiredTheme = resolveInitialTheme(null);
        const isDark = document.body.classList.contains('theme-dark');
        if ((desiredTheme === 'dark') !== isDark) {
          document.body.classList.toggle('theme-dark', desiredTheme === 'dark');
          updateThemeIcon();
        }
      }, 30 * 60 * 1000);
    }

    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('theme-dark');
      const isDark = document.body.classList.contains('theme-dark');
      localStorage.setItem('tree-theme', isDark ? 'dark' : 'light');
      if (autoThemeTimer) {
        clearInterval(autoThemeTimer);
        autoThemeTimer = null;
      }
      updateThemeIcon();
    });
  }
  function updateThemeIcon() {
    if (!themeBtn) return;
    const isDark = document.body.classList.contains('theme-dark');
    themeBtn.innerHTML = isDark ? '&#9790;' : '&#9728;';
    themeBtn.classList.toggle('sun-icon', !isDark);
    themeBtn.classList.toggle('moon-icon', isDark);
    const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.setAttribute('title', label);
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
  document.getElementById('zoomInBtn').addEventListener('click', () => smoothZoom(1.2));
  document.getElementById('zoomOutBtn').addEventListener('click', () => smoothZoom(1/1.1));
  document.getElementById('resetBtn').addEventListener('click', () => fitToScreen(50));
  const focusBtn = document.getElementById('focusBtn');
  let focusModeActive = document.body.classList.contains('focus-mode');
  if (focusBtn) {
    focusBtn.setAttribute('aria-pressed', focusModeActive ? 'true' : 'false');
    updateFocusModeUI();
    focusBtn.addEventListener('click', () => {
      focusModeActive = !focusModeActive;
      document.body.classList.toggle('focus-mode', focusModeActive);
      focusBtn.setAttribute('aria-pressed', focusModeActive ? 'true' : 'false');
      updateFocusModeUI();
      fitToScreen(focusModeActive ? 80 : 50);
      if (focusModeActive) setCalendarOpen(false);
    });
  }

  function updateFocusModeUI() {
    if (!focusBtn) return;
    const isActive = document.body.classList.contains('focus-mode');
    focusBtn.textContent = isActive ? 'Exit Focus' : 'Focus';
    const label = isActive ? 'Exit focus mode' : 'Enter focus mode';
    focusBtn.setAttribute('aria-label', label);
    focusBtn.setAttribute('title', label);
  }

  function smoothZoom(factor) {
    svg.transition().duration(250).call(zoom.scaleBy, factor);
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
    const safeScale = Math.max(scale, 0.02);
    const minScale = Math.max(safeScale * 0.85, 0.02);
    const maxScale = Math.max(6, safeScale * 5);
    zoom.scaleExtent([minScale, maxScale]);
    const t = d3.zoomIdentity.translate(tx, ty).scale(safeScale);
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
    .then((data) => {
      const normalized = normalizeData(data);
      renderBirthdayStrip(normalized);
      renderUpcomingBanner(normalized);
      setupCarouselControls();
      render(normalized);
    })
    .catch((err) => {
      console.error('Failed to load data', err);
      if (birthdayMonthsEl) {
        birthdayMonthsEl.textContent = 'Failed to load family data';
      }
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
    return obj && (obj.Parent || obj.Grandparent);
  }

  function normalizeData(input) {
    if (looksLikeRFamilySchema(input)) {
      return attachThumbs(transformRFamily(input));
    }
    return attachThumbs(input); // already couple-style
  }
  // Transform rfamily.json into a uniform couple tree (preserving image + gender)
  function transformRFamily(src) {
    const paternal = src.parents ? src.parents : null;
    const maternal = src.spouse && src.spouse.parents ? src.spouse.parents : null;
    const grandparentName = safe(src.Grandparent);
    const grandparentSpouse = safe(src.spouse && src.spouse.name);
    const gpCouple = {
      name: grandparentName,
      image: safe(src.image),
      birthday: safe(src.birthday || src.dob),
      spouse: grandparentSpouse,
      spouseImage: safe(src.spouse && src.spouse.image),
      spouseBirthday: safe(src.spouse && (src.spouse.birthday || src.spouse.dob)),
      tags: readTags(src.tags),
      spouseTags: readTags(src.spouse && src.spouse.tags),
      children: []
    };
    if (paternal && (safe(paternal.name) || (paternal.spouse && safe(paternal.spouse.name)))) {
      gpCouple.parents = {
        name: safe(paternal.name),
        image: safe(paternal.image),
        birthday: safe(paternal.birthday || paternal.dob),
        spouse: paternal.spouse ? safe(paternal.spouse.name) : '',
        spouseImage: paternal.spouse ? safe(paternal.spouse.image) : '',
        spouseBirthday: paternal.spouse ? safe(paternal.spouse.birthday || paternal.spouse.dob) : '',
        tags: readTags(paternal.tags),
        spouseTags: readTags(paternal.spouse && paternal.spouse.tags)
      };
    }
    if (maternal && (safe(maternal.name) || (maternal.spouse && safe(maternal.spouse.name)))) {
      gpCouple.spouseParents = {
        name: safe(maternal.name),
        image: safe(maternal.image),
        birthday: safe(maternal.birthday || maternal.dob),
        spouse: maternal.spouse ? safe(maternal.spouse.name) : '',
        spouseImage: maternal.spouse ? safe(maternal.spouse.image) : '',
        spouseBirthday: maternal.spouse ? safe(maternal.spouse.birthday || maternal.spouse.dob) : '',
        tags: readTags(maternal.tags),
        spouseTags: readTags(maternal.spouse && maternal.spouse.tags)
      };
    }

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
          birthday: safe(p.prevSpouse.birthday || p.prevSpouse.dob),
          tags: readTags(p.prevSpouse.tags),
          spouseTags: readTags(p.prevSpouse.spouse && p.prevSpouse.spouse.tags)
        } : undefined),
        spouse: safe(p.spouse && p.spouse.name),
        spouseImage: safe(p.spouse && p.spouse.image),
        spouseBirthday: safe(p.spouse && (p.spouse.birthday || p.spouse.dob)),
        tags: readTags(p.tags),
        spouseTags: readTags(p.spouse && p.spouse.tags),
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
          tags: readTags(k.tags),
          spouseTags: readTags(k.spouse && k.spouse.tags),
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
            birthday: safe(gchild.birthday || gchild.dob),
            tags: readTags(gchild.tags)
          });
        });
      });

      // Support simpler case where Parent lists immediate children as strings.
      if (Array.isArray(p.childrenStrings)) {
        p.childrenStrings.forEach((nm) => pc.children.push({ name: safe(nm) }));
      }
    });

    return gpCouple;
  }

  function thumbPath(image) {
    const s = safe(image).trim();
    if (!s || s.startsWith('data:')) return '';
    if (s.startsWith('images/thumbs/')) return s;
    if (s.startsWith('images/')) return `images/thumbs/${s.slice('images/'.length)}`;
    return s;
  }

  function attachThumbs(node) {
    if (!node || typeof node !== 'object') return node;
    node.thumb = node.thumb || thumbPath(node.image);
    node.spouseThumb = node.spouseThumb || thumbPath(node.spouseImage);
    if (node.prevSpouse) {
      node.prevSpouse.thumb = node.prevSpouse.thumb || thumbPath(node.prevSpouse.image);
    }
    if (node.parents) {
      node.parents.thumb = node.parents.thumb || thumbPath(node.parents.image);
      if (node.parents.spouse || node.parents.spouseImage) {
        node.parents.spouseThumb = node.parents.spouseThumb || thumbPath(node.parents.spouseImage);
      }
    }
    if (node.spouseParents) {
      node.spouseParents.thumb = node.spouseParents.thumb || thumbPath(node.spouseParents.image);
      if (node.spouseParents.spouse || node.spouseParents.spouseImage) {
        node.spouseParents.spouseThumb = node.spouseParents.spouseThumb || thumbPath(node.spouseParents.spouseImage);
      }
    }
    (node.children || []).forEach((child) => attachThumbs(child));
    return node;
  }

  function renderBirthdayStrip(data) {
    if (!birthdayMonthsEl) return;
    const buckets = collectBirthdays(data);
    const now = new Date();
    const currentMonthIdx = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();
    birthdayMonthsEl.innerHTML = '';

    monthsMeta.forEach((meta, idx) => {
      const monthBucket = buckets[idx] || {};
      const total = Object.keys(monthBucket).length;

      const card = document.createElement('article');
      card.className = 'month-card';
      if (idx === currentMonthIdx) card.classList.add('current');
      card.dataset.monthIndex = idx;

      const detailsId = `month-details-${idx}`;
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'month-head';
      head.setAttribute('aria-expanded', 'false');
      head.setAttribute('aria-controls', detailsId);
      const title = document.createElement('span');
      title.className = 'month-title';
      title.textContent = meta.long;
      const expandIcon = document.createElement('span');
      expandIcon.className = 'month-expand-icon';
      expandIcon.textContent = '+';
      head.appendChild(title);
      head.appendChild(expandIcon);
      card.appendChild(head);

      const count = document.createElement('div');
      count.className = 'month-count';
      count.textContent = formatCount(total);
      card.appendChild(count);

      const body = document.createElement('div');
      body.className = 'month-body';

      const weekdayRow = document.createElement('div');
      weekdayRow.className = 'weekday-row';
      ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sam', 'Dum'].forEach((abbr) => {
        const el = document.createElement('div');
        el.textContent = abbr;
        weekdayRow.appendChild(el);
      });
      body.appendChild(weekdayRow);

      const grid = document.createElement('div');
      grid.className = 'month-grid';
      const daysInMonth = getDaysInMonth(currentYear, idx);
      const offset = getFirstDayOffset(currentYear, idx);
      for (let i = 0; i < offset; i++) {
        const pad = document.createElement('div');
        pad.className = 'day-cell pad';
        grid.appendChild(pad);
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        const names = monthBucket[day] || [];
        if (names.length) {
          cell.classList.add('has-birthday');
          cell.dataset.names = names.join('||');
          cell.dataset.dateLabel = `${meta.long} ${String(day).padStart(2, '0')}`;
        }
        if (idx === currentMonthIdx && day === currentDay) {
          cell.classList.add('today');
        }

        const num = document.createElement('div');
        num.className = 'day-num';
        num.textContent = day;
        cell.appendChild(num);

        const labelDay = String(day).padStart(2, '0');
        cell.title = names.length
          ? `${meta.long} ${labelDay}: ${names.join(', ')}`
          : `${meta.long} ${labelDay}`;

        if (names.length) {
          cell.addEventListener('mouseenter', (e) => showBirthdayTooltip(e.currentTarget));
          cell.addEventListener('mouseleave', hideBirthdayTooltip);
          cell.addEventListener('click', (e) => {
            e.stopPropagation();
            const personName = names[0];
            const person = names.length === 1 ? personLookup.get(personName) : null;
            if (person) {
              hideBirthdayTooltip();
              openModal({
                name: person.name,
                image: person.image || placeholderDataUrl,
                birthday: person.birthday
              });
              return;
            }
            const isActive = birthdayTooltip && birthdayTooltip.classList.contains('show') && activeTooltipCell === e.currentTarget;
            if (isActive) {
              hideBirthdayTooltip();
            } else {
              showBirthdayTooltip(e.currentTarget);
            }
          });
        }

        grid.appendChild(cell);
      }
      body.appendChild(grid);
      card.appendChild(body);

      const details = document.createElement('div');
      details.className = 'month-details';
      details.id = detailsId;
      details.setAttribute('aria-hidden', 'true');
      if (total === 0) {
        const empty = document.createElement('div');
        empty.className = 'month-empty';
        empty.textContent = 'Nicio aniversare';
        details.appendChild(empty);
      } else {
        const list = document.createElement('ul');
        list.className = 'month-list';
        const days = Object.keys(monthBucket)
          .map((day) => Number(day))
          .sort((a, b) => a - b);
        days.forEach((day) => {
          const names = monthBucket[day] || [];
          if (!names.length) return;
          const li = document.createElement('li');
          const dayLabel = document.createElement('span');
          dayLabel.className = 'month-day';
          dayLabel.textContent = String(day).padStart(2, '0');
          const namesLabel = document.createElement('span');
          namesLabel.className = 'month-names';
          namesLabel.textContent = names.join(', ');
          li.appendChild(dayLabel);
          li.appendChild(namesLabel);
          list.appendChild(li);
        });
        details.appendChild(list);
      }
      card.appendChild(details);

      head.addEventListener('click', () => {
        const isExpanded = card.classList.toggle('expanded');
        details.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
        head.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        expandIcon.textContent = isExpanded ? '-' : '+';
        if (!isExpanded || !birthdayMonthsEl) return;
        birthdayMonthsEl.querySelectorAll('.month-card.expanded').forEach((other) => {
          if (other === card) return;
          other.classList.remove('expanded');
          const otherDetails = other.querySelector('.month-details');
          if (otherDetails) otherDetails.setAttribute('aria-hidden', 'true');
          const otherHead = other.querySelector('.month-head');
          if (otherHead) otherHead.setAttribute('aria-expanded', 'false');
          const otherIcon = other.querySelector('.month-expand-icon');
          if (otherIcon) otherIcon.textContent = '+';
        });
      });
      birthdayMonthsEl.appendChild(card);
    });
  }

  function formatCount(total) {
    const word = total === 1 ? 'zi de nastere' : 'zile de nastere';
    return `${total} ${word}`;
  }

  const UPCOMING_WINDOW_DAYS = 10;

  function getUpcomingBirthdays(data, windowDays = UPCOMING_WINDOW_DAYS) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    const people = [];

    function addPerson(name, birthday, image) {
      const parsed = parseBirthday(birthday);
      if (!parsed) return;
      const next = new Date(today.getFullYear(), parsed.month - 1, parsed.day);
      if (next < today) next.setFullYear(next.getFullYear() + 1);
      const daysAway = Math.round((next - today) / msPerDay);
      if (daysAway < 0 || daysAway > windowDays) return;
      people.push({
        name: safe(name),
        birthday: birthday || '',
        image: image || '',
        daysAway,
        label: `${String(parsed.day).padStart(2, '0')} ${monthsMeta[parsed.month - 1].short}`
      });
    }

    function walk(node) {
      if (!node || typeof node !== 'object') return;
      addPerson(node.name, node.birthday, node.image);
      addPerson(node.spouse, node.spouseBirthday, node.spouseImage);
      if (node.prevSpouse) addPerson(node.prevSpouse.name, node.prevSpouse.birthday, node.prevSpouse.image);
      if (node.parents) {
        addPerson(node.parents.name, node.parents.birthday, node.parents.image);
        addPerson(node.parents.spouse, node.parents.spouseBirthday, node.parents.spouseImage);
      }
      if (node.spouseParents) {
        addPerson(node.spouseParents.name, node.spouseParents.birthday, node.spouseParents.image);
        addPerson(node.spouseParents.spouse, node.spouseParents.spouseBirthday, node.spouseParents.spouseImage);
      }
      (node.children || []).forEach((child) => walk(child));
    }

    walk(data);
    // Deduplicate by name keeping closest
    const byName = new Map();
    people.forEach((p) => {
      if (!p.name) return;
      if (!byName.has(p.name) || p.daysAway < byName.get(p.name).daysAway) {
        byName.set(p.name, p);
      }
    });
    return Array.from(byName.values()).sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));
  }

  function renderUpcomingBanner(data) {
    if (!upcomingBanner) return;
    const upcoming = getUpcomingBirthdays(data);
    if (!upcoming.length) {
      upcomingBanner.hidden = true;
      upcomingBanner.classList.remove('show');
      return;
    }
    const useTicker = mobileQuery.matches && upcoming.length >= 3;
    const maxShow = 6;
    const visible = useTicker ? upcoming : upcoming.slice(0, maxShow);
    const moreCount = useTicker ? 0 : (upcoming.length - visible.length);
    const pills = visible.map((p) => {
      const when = p.daysAway === 0 ? 'Astazi' : (p.daysAway === 1 ? 'Maine' : `In ${p.daysAway} zile`);
      return `<button class="pill" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)} <span class="tag">${when}</span></button>`;
    }).join('');
    const more = moreCount > 0 ? `<span class="more">+${moreCount} altele</span>` : '';
    const listContent = `${pills}${more}`;
    const listMarkup = useTicker ? `<div class="upcoming-track">${listContent}</div>` : listContent;
    upcomingBanner.innerHTML = `
      <div class="upcoming-label">Zile de nastere in ${UPCOMING_WINDOW_DAYS} zile:</div>
      <div class="upcoming-list">${listMarkup}</div>
      <button class="close-btn" aria-label="Ascunde notificarea">×</button>
    `;
    upcomingBanner.hidden = false;
    upcomingBanner.classList.add('show');
    upcomingBanner.classList.toggle('ticker', useTicker);
    if (useTicker) {
      upcomingBanner.style.setProperty('--banner-speed', `${Math.max(14, visible.length * 4)}s`);
    } else {
      upcomingBanner.style.removeProperty('--banner-speed');
    }

    const closeBtn = upcomingBanner.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        upcomingBanner.hidden = true;
        upcomingBanner.classList.remove('show');
      });
    }
    upcomingBanner.querySelectorAll('.pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const n = pill.dataset.name;
        const info = personLookup.get(n);
        if (info) {
          openModal({ name: info.name, image: info.image || placeholderDataUrl, birthday: info.birthday });
        }
      });
    });
  }

  function getDaysInMonth(year, monthIdx) {
    return new Date(year, monthIdx + 1, 0).getDate();
  }

  function getFirstDayOffset(year, monthIdx) {
    // JS getDay: 0 Sun, 1 Mon ... -> shift so Monday is 0
    const jsDay = new Date(year, monthIdx, 1).getDay();
    return (jsDay + 6) % 7;
  }

  function showBirthdayTooltip(cell) {
    if (!birthdayTooltip) return;
    const names = (cell.dataset.names || '').split('||').filter(Boolean);
    if (!names.length) return;
    const dateLabel = cell.dataset.dateLabel || '';
    activeTooltipCell = cell;
    birthdayTooltip.innerHTML = `
      <div class="tooltip-date">${dateLabel}</div>
      <ul class="tooltip-list">
        ${names.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
      </ul>
    `;
    birthdayTooltip.hidden = false;
    birthdayTooltip.classList.add('show');
    // Position tooltip above the calendar, near the cell
    const rect = cell.getBoundingClientRect();
    const tipRect = birthdayTooltip.getBoundingClientRect();
    const top = Math.max(8, rect.top - tipRect.height - 10);
    const left = Math.min(
      window.innerWidth - tipRect.width - 8,
      Math.max(8, rect.left + rect.width / 2 - tipRect.width / 2)
    );
    birthdayTooltip.style.top = `${top}px`;
    birthdayTooltip.style.left = `${left}px`;
  }

  function hideBirthdayTooltip() {
    if (!birthdayTooltip) return;
    activeTooltipCell = null;
    birthdayTooltip.classList.remove('show');
    birthdayTooltip.hidden = true;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setCalendarOpen(open) {
    calendarOpen = open;
    document.body.classList.toggle('calendar-open', open);
    if (calendarSection) calendarSection.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (calendarToggle) {
      calendarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      calendarToggle.textContent = open ? 'Inchide Calendar' : 'Deschide Calendar';
    }
    if (!open) hideBirthdayTooltip();
    if (open) {
      applyMobileState && applyMobileState();
      queueCalendarScroll();
    }
  }

  function queueCalendarScroll() {
    if (!birthdayMonthsEl) return;
    if (birthdayMonthsEl.classList.contains('mobile-carousel')) return;
    requestAnimationFrame(() => {
      if (!calendarOpen) return;
      scrollCalendarToCurrentMonth();
    });
  }

  function scrollCalendarToCurrentMonth() {
    if (!birthdayMonthsEl) return;
    const current = birthdayMonthsEl.querySelector('.month-card.current');
    if (!current) return;
    const sectionRect = birthdayMonthsEl.getBoundingClientRect();
    const cardRect = current.getBoundingClientRect();
    const target = cardRect.top - sectionRect.top + birthdayMonthsEl.scrollTop - 8;
    birthdayMonthsEl.scrollTop = Math.max(0, target);
  }

  if (calendarToggle) {
    calendarToggle.addEventListener('click', () => setCalendarOpen(!calendarOpen));
  }
  // Start collapsed by default
  setCalendarOpen(false);

  function setupCarouselControls() {
    if (!birthdayMonthsEl) return;
    applyMobileState = () => {
      const mobileContext = mobileQuery.matches;
      mobileShowAll = mobileContext;
      birthdayMonthsEl.classList.toggle('mobile-show-all', mobileShowAll);
      birthdayMonthsEl.classList.remove('mobile-carousel');
      if (calendarSection) calendarSection.classList.toggle('calendar-full', mobileShowAll);
      // show all months
      birthdayMonthsEl.querySelectorAll('.month-card').forEach((card) => card.classList.remove('active'));
      detachSwipe();
      if (carouselControls) carouselControls.style.display = 'none';
      if (calendarSideNav) calendarSideNav.style.display = 'none';
    };
    mobileQuery.addEventListener('change', () => applyMobileState && applyMobileState());
    if (applyMobileState) applyMobileState();

    const prevHandler = () => shiftMonth(-1);
    const nextHandler = () => shiftMonth(1);
    if (monthPrevBtn) monthPrevBtn.addEventListener('click', prevHandler);
    if (monthNextBtn) monthNextBtn.addEventListener('click', nextHandler);
    if (calendarSidePrev) calendarSidePrev.addEventListener('click', prevHandler);
    if (calendarSideNext) calendarSideNext.addEventListener('click', nextHandler);
  }

  function shiftMonth(delta) {
    const cards = Array.from(birthdayMonthsEl ? birthdayMonthsEl.querySelectorAll('.month-card') : []);
    if (!cards.length) return;
    mobileMonthIndex = (mobileMonthIndex + delta + cards.length) % cards.length;
    updateActiveMonthDisplay();
  }

  function ensureActiveMonth() {
    const cards = Array.from(birthdayMonthsEl ? birthdayMonthsEl.querySelectorAll('.month-card') : []);
    if (!cards.length) return;
    const active = cards.find((c) => c.classList.contains('current'));
    mobileMonthIndex = active ? Number(active.dataset.monthIndex || 0) : (new Date().getMonth() % cards.length);
  }

  function updateActiveMonthDisplay() {
    if (!birthdayMonthsEl || mobileShowAll) return;
    const cards = Array.from(birthdayMonthsEl.querySelectorAll('.month-card'));
    cards.forEach((card, i) => {
      card.classList.toggle('active', i === mobileMonthIndex);
    });
    hideBirthdayTooltip();
  }

  function attachSwipe() {
    if (!birthdayMonthsEl) return;
    birthdayMonthsEl.addEventListener('touchstart', onTouchStart, { passive: true });
    birthdayMonthsEl.addEventListener('touchend', onTouchEnd, { passive: true });
  }
  function detachSwipe() {
    if (!birthdayMonthsEl) return;
    birthdayMonthsEl.removeEventListener('touchstart', onTouchStart);
    birthdayMonthsEl.removeEventListener('touchend', onTouchEnd);
  }
  function onTouchStart(e) {
    if (!mobileQuery.matches) return;
    const t = e.touches && e.touches[0];
    touchStartX = t ? t.clientX : null;
  }
  function onTouchEnd(e) {
    if (!mobileQuery.matches) return;
    if (touchStartX == null) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    touchStartX = null;
    const threshold = 40;
    if (Math.abs(dx) < threshold) return;
    shiftMonth(dx < 0 ? 1 : -1);
  }

  function collectBirthdays(data) {
    personLookup.clear();
    const months = Array.from({ length: 12 }, () => ({}));
    function rememberPerson(name, birthday, image) {
      const key = (name || '').trim();
      if (!key) return;
      if (!personLookup.has(key)) {
        personLookup.set(key, { name: key, birthday: birthday || '', image: image || '' });
      }
    }
    function add(name, birthday, image) {
      const parsed = parseBirthday(birthday);
      if (!parsed) return;
      const label = safe(name);
      if (!label) return;
      rememberPerson(label, birthday, image);
      const bucket = months[parsed.month - 1];
      if (!bucket[parsed.day]) bucket[parsed.day] = [];
      bucket[parsed.day].push(label);
    }
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      add(node.name, node.birthday, node.image);
      add(node.spouse, node.spouseBirthday, node.spouseImage);
      if (node.prevSpouse) add(node.prevSpouse.name, node.prevSpouse.birthday, node.prevSpouse.image);
      if (node.parents) {
        add(node.parents.name, node.parents.birthday, node.parents.image);
        add(node.parents.spouse, node.parents.spouseBirthday, node.parents.spouseImage);
      }
      if (node.spouseParents) {
        add(node.spouseParents.name, node.spouseParents.birthday, node.spouseParents.image);
        add(node.spouseParents.spouse, node.spouseParents.spouseBirthday, node.spouseParents.spouseImage);
      }
      (node.children || []).forEach((child) => walk(child));
    }
    walk(data);
    return months;
  }

  function parseBirthday(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    const ro = str.match(/^(\d{1,2})[.\-/\s](\d{1,2})[.\-/\s](\d{4})$/);
    const iso = !ro && str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let day, month, year;
    if (ro) {
      day = Number(ro[1]);
      month = Number(ro[2]);
      year = Number(ro[3]);
    } else if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]);
      day = Number(iso[3]);
    } else {
      return null;
    }
    const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > daysInMonth[month - 1]) return null;
    return { month, day };
  }

  function safe(v) { return (v == null ? '' : String(v)); }
  function readTags(value) {
    if (!value) return [];
    if (typeof value === 'string') return [value.trim()].filter(Boolean);
    if (Array.isArray(value)) {
      return value
        .map((tag) => (tag == null ? '' : String(tag).trim()))
        .filter((tag) => tag.length > 0);
    }
    if (typeof value === 'object' && value.tag) {
      return readTags(value.tag);
    }
    return [];
  }

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

    function addOverlayCouple(info, placementAnchor, childAnchor, alignCenter = null, swapPrimarySpouse = false) {
      if (!info || !placementAnchor || !childAnchor) return;
      const data = {
        name: safe(info.name),
        image: safe(info.image),
        birthday: safe(info.birthday),
        spouse: safe(info.spouse),
        spouseImage: safe(info.spouseImage),
        spouseBirthday: safe(info.spouseBirthday),
        tags: readTags(info.tags),
        spouseTags: readTags(info.spouseTags || (info.spouse && info.spouse.tags))
      };
      if (swapPrimarySpouse) {
        const tmp = {
          name: data.name,
          image: data.image,
          birthday: data.birthday,
          tags: data.tags
        };
        data.name = data.spouse;
        data.image = data.spouseImage;
        data.birthday = data.spouseBirthday;
        data.tags = data.spouseTags;
        data.spouse = tmp.name;
        data.spouseImage = tmp.image;
        data.spouseBirthday = tmp.birthday;
        data.spouseTags = tmp.tags;
      }
      if (!data.name && !data.spouse) return;
      const layout = layoutFor(data);
      let centerX = placementAnchor.x + (person.width / 2);
      if (alignCenter === 'primary') {
        const primaryCenter = layout.xPrimary + (person.width / 2);
        centerX = childAnchor.x - primaryCenter;
      } else if (alignCenter === 'spouse' && layout.hasRight) {
        const spouseCenter = layout.xRightSpouse + (person.width / 2);
        centerX = childAnchor.x - spouseCenter;
      }
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
      const childPoint = { x: childAnchor.x, y: childAnchor.y };
      branches.push({ source: mergeTarget, target: childPoint });
      overlayCouples.push({ center, layout, data });
    }
    root.descendants().forEach((p) => {
      // place each parent pair centered above its respective child/spouse
      if (p.data && p.data.spouseParents) {
        const childAnchor = topOfRightSpouse(p);
        const placementAnchor = childAnchor ? {
          x: childAnchor.x - (person.width / 2),
          y: childAnchor.y - person.height - mergePad
        } : childAnchor;
        // Swap so father renders on the right of the mother above Ana
        // Align mother (after swap) over Ana; father sits to her right
        addOverlayCouple(p.data.spouseParents, placementAnchor, childAnchor, 'primary', true);
      }
      if (p.data && p.data.parents) {
        const childAnchor = topOfPrimary(p);
        const placementAnchor = {
          x: childAnchor.x - (person.width / 2),
          y: childAnchor.y - person.height - mergePad
        };
        // Align mother (spouse) over Ioan; father sits to her left
        addOverlayCouple(p.data.parents, placementAnchor, childAnchor, 'spouse', false);
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
      if (/[aÄƒÃ¢]$/.test(lower) || femaleList.includes(lower)) return false;
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
        thumb: d.data.thumb,
        birthday: d.data.birthday,
        role: 'primary',
        tags: d.data.tags
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
          thumb: ps.thumb,
          birthday: ps.birthday,
          role: 'spouse',
          tags: ps.tags
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
          thumb: d.data.spouseThumb,
          birthday: d.data.spouseBirthday,
          role: 'spouse',
          tags: d.data.spouseTags
        });
      }
    });

    if (overlayCouples.length) {
      const overlayLayer = g.append('g').attr('class', 'overlay-layer').lower();
      const overlayGroup = overlayLayer
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
          thumb: d.data.thumb,
          birthday: d.data.birthday,
          role: 'primary',
          tags: d.data.tags
        });

        if (L.hasRight) {
          drawPerson(group, {
            x: L.xRightSpouse,
            y: -person.height / 2,
            name: d.data.spouse,
            image: d.data.spouseImage,
            thumb: d.data.spouseThumb,
            birthday: d.data.spouseBirthday,
            role: 'spouse',
            tags: d.data.spouseTags
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

    // DNA overlay group (gold) with toggle â€” show full T via DNA parent only
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
    const tagList = Array.isArray(opts.tags) ? opts.tags : [];
    const normalizedTags = tagList
      .map((tag) => (tag == null ? '' : String(tag).trim().toLowerCase()))
      .filter((tag) => tag.length > 0);
    const hasVeteranTag = normalizedTags.includes('veteran');
    const classes = ['person'];
    if (opts.role) classes.push(opts.role);
    if (hasVeteranTag) classes.push('tag-veteran');

    const gPerson = sel.append('g').attr('class', classes.join(' ')).attr('transform', `translate(${opts.x},${opts.y})`);

    gPerson.append('rect')
      .attr('width', person.width)
      .attr('height', person.height)
      .attr('rx', 12).attr('ry', 12);

    if (hasVeteranTag) {
      const badge = gPerson.append('g')
        .attr('class', 'badge-veteran')
        .attr('transform', 'translate(22, 20)')
        .attr('pointer-events', 'none');

      badge.append('path')
        .attr('class', 'medal-ribbon')
        .attr('d', 'M -6 10 L -2 4 L 0 10 L 2 4 L 6 10 L 6 18 L 2 14 L 0 18 L -2 14 L -6 18 Z');

      badge.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 11);

      badge.append('path')
        .attr('class', 'medal-star')
        .attr('d', 'M 0,-7 L 2.2,-2.2 L 7,-2.2 L 3.2,0.8 L 4.6,6 L 0,3.2 L -4.6,6 L -3.2,0.8 L -7,-2.2 L -2.2,-2.2 Z');
    }

    // Avatar (image clipped to a circle) centered above the name
    const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;
    const cp = defs.append('clipPath').attr('id', clipId);
    cp.append('circle').attr('cx', 0).attr('cy', 0).attr('r', avatar.r);

    const cx = person.width / 2;
    const cy = avatar.top + avatar.r;
    const gAvatar = gPerson.append('g').attr('transform', `translate(${cx},${cy})`);
    const thumbSrc = opts.thumb || thumbPath(opts.image);
    const fullSrc = opts.image || '';
    const preferred = thumbSrc || fullSrc || placeholderDataUrl;
    const imgEl = gAvatar.append('image')
      .attr('href', preferred)
      .attr('xlink:href', preferred) // Safari compatibility
      .attr('x', -avatar.r)
      .attr('y', -avatar.r)
      .attr('width', avatar.r * 2)
      .attr('height', avatar.r * 2)
      .attr('clip-path', `url(#${clipId})`)
      .attr('preserveAspectRatio', 'xMidYMid slice');
    // If thumb fails, fall back to full image or placeholder.
    imgEl.on('error', function () {
      const fallback = fullSrc || placeholderDataUrl;
      if (!fallback || this.getAttribute('href') === fallback) return;
      this.setAttribute('href', fallback);
      this.setAttributeNS('http://www.w3.org/1999/xlink', 'href', fallback);
    });

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
    if (/[aÄƒÃ¢]$/.test(lower) || ['elena','ana','maria','simona','corina','sonia','olivia','damaris','csilla','susana'].includes(lower)) return 'F';
    if (isSpouse) return 'F';
    return 'M';
  }
})();






