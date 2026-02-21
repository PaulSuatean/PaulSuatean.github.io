(function () {
  if (!document.body) return;

  const themeKey = 'tree-theme';
  const savedTheme = localStorage.getItem(themeKey);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldUseDark = savedTheme ? savedTheme === 'dark' : prefersDark;
  if (shouldUseDark && !document.body.classList.contains('theme-dark')) {
    document.body.classList.add('theme-dark');
  }

  const layers = [
    { className: 'night-sky__layer layer-1', depth: 0.12, density: 0.00014, size: [0.6, 1.4], alpha: [0.55, 0.9] },
    { className: 'night-sky__layer layer-2', depth: 0.26, density: 0.00009, size: [0.8, 1.8], alpha: [0.35, 0.7] },
    { className: 'night-sky__layer layer-3', depth: 0.4, density: 0.00006, size: [1.0, 2.2], alpha: [0.25, 0.6] }
  ];

  function drawStars(canvas, config) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const area = width * height;
    const count = Math.max(60, Math.round(area * config.density));
    for (let i = 0; i < count; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = config.size[0] + Math.random() * (config.size[1] - config.size[0]);
      const alpha = config.alpha[0] + Math.random() * (config.alpha[1] - config.alpha[0]);
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function initSky(target) {
    if (target.querySelector('.night-sky')) return;

    const skyEl = document.createElement('div');
    skyEl.className = 'night-sky';
    skyEl.setAttribute('aria-hidden', 'true');
    if (target !== document.body) {
      skyEl.classList.add('night-sky--scoped');
      const targetStyle = window.getComputedStyle(target);
      if (targetStyle.position === 'static') {
        target.style.position = 'relative';
      }
    }

    const layerEls = layers.map((layer) => {
      const canvas = document.createElement('canvas');
      canvas.className = layer.className;
      canvas.dataset.depth = String(layer.depth);
      skyEl.appendChild(canvas);
      return canvas;
    });

    if (target === document.body) {
      document.body.prepend(skyEl);
    } else {
      target.prepend(skyEl);
    }

    function applySkyVisibility() {
      const isDark = document.body.classList.contains('theme-dark');
      skyEl.style.opacity = isDark ? '1' : '0';
    }

    applySkyVisibility();

    if (target === document.body && window.MutationObserver) {
      const observer = new MutationObserver((entries) => {
        for (const entry of entries) {
          if (entry.attributeName === 'class') {
            applySkyVisibility();
            break;
          }
        }
      });
      observer.observe(document.body, { attributes: true });
    }

    function getCanvasSize() {
      if (target === document.body) {
        const doc = document.documentElement;
        const width = Math.max(doc.scrollWidth, doc.clientWidth, window.innerWidth || 0, document.body.scrollWidth || 0);
        const height = Math.max(doc.scrollHeight, doc.clientHeight, window.innerHeight || 0, document.body.scrollHeight || 0);
        return { width: Math.max(1, width), height: Math.max(1, height) };
      } else {
        const rect = target.getBoundingClientRect();
        return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
      }
    }

    function resizeCanvases() {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = getCanvasSize();
      layerEls.forEach((canvas, index) => {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        drawStars(canvas, layers[index]);
      });
    }

    resizeCanvases();

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function onMouseMove(e) {
      const rect = target === document.body ? 
        { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 } :
        target.getBoundingClientRect();
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Normalize to -1 to 1 range
      targetX = (e.clientX - rect.left - centerX) / centerX;
      targetY = (e.clientY - rect.top - centerY) / centerY;
      
      // Clamp values
      targetX = Math.max(-1, Math.min(1, targetX));
      targetY = Math.max(-1, Math.min(1, targetY));
    }

    function animate() {
      // Smooth easing (lerp with factor 0.08 for smooth movement)
      const ease = 0.08;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;

      layerEls.forEach((canvas, index) => {
        const depth = layers[index].depth;
        // Subtle movement - max 20 pixels
        const maxMove = 20;
        const moveX = currentX * depth * maxMove;
        const moveY = currentY * depth * maxMove;
        canvas.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
      });

      requestAnimationFrame(animate);
    }

    animate();

    const element = target === document.body ? window : target;
    element.addEventListener('mousemove', onMouseMove);

    if (target === document.body) {
      window.addEventListener('resize', resizeCanvases);
      if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => resizeCanvases());
        resizeObserver.observe(document.documentElement);
      }
    } else {
      if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => resizeCanvases());
        resizeObserver.observe(target);
      }
    }
  }

  const rawTargets = Array.from(document.querySelectorAll('[data-night-sky]'));
  const targets = rawTargets.length > 0 ? rawTargets : [document.body];

  targets.forEach(initSky);
})();
