(function (global) {
  const DEFAULT_THEME_KEY = 'tree-theme';
  const DEFAULT_DARK_CLASS = 'theme-dark';

  function isNightTime() {
    const hour = new Date().getHours();
    return hour >= 20 || hour < 7;
  }

  function resolveInitialTheme(savedTheme) {
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return isNightTime() ? 'dark' : 'light';
  }

  function setThemeButtonState(themeBtn, isDark, options) {
    if (!themeBtn) return;

    const icon = themeBtn.querySelector('.material-symbols-outlined');
    const iconName = isDark ? options.iconWhenDark : options.iconWhenLight;

    if (icon) {
      icon.textContent = iconName;
    } else {
      themeBtn.textContent = iconName;
    }

    themeBtn.classList.toggle(options.darkButtonClass, isDark);
    themeBtn.classList.toggle(options.lightButtonClass, !isDark);

    const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.setAttribute('title', label);
    themeBtn.setAttribute('aria-pressed', String(isDark));
  }

  function initThemeToggle(userOptions) {
    const options = {
      themeKey: DEFAULT_THEME_KEY,
      darkClass: DEFAULT_DARK_CLASS,
      button: document.getElementById('themeBtn'),
      iconWhenDark: 'light_mode',
      iconWhenLight: 'dark_mode',
      darkButtonClass: 'sun-icon',
      lightButtonClass: 'moon-icon',
      autoRefreshMs: 0,
      persistInitialTheme: false,
      ...userOptions
    };

    const themeBtn = options.button;
    const savedTheme = localStorage.getItem(options.themeKey);
    const initialTheme = resolveInitialTheme(savedTheme);
    document.body.classList.toggle(options.darkClass, initialTheme === 'dark');
    if (!savedTheme && options.persistInitialTheme) {
      localStorage.setItem(options.themeKey, initialTheme);
    }
    setThemeButtonState(themeBtn, initialTheme === 'dark', options);

    let autoThemeTimer = null;
    if (!savedTheme && options.autoRefreshMs > 0) {
      autoThemeTimer = window.setInterval(() => {
        if (localStorage.getItem(options.themeKey)) {
          window.clearInterval(autoThemeTimer);
          autoThemeTimer = null;
          return;
        }

        const desiredTheme = resolveInitialTheme(null);
        const isDark = document.body.classList.contains(options.darkClass);
        const shouldBeDark = desiredTheme === 'dark';
        if (isDark !== shouldBeDark) {
          document.body.classList.toggle(options.darkClass, shouldBeDark);
          setThemeButtonState(themeBtn, shouldBeDark, options);
        }
      }, options.autoRefreshMs);
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const nextIsDark = !document.body.classList.contains(options.darkClass);
        document.body.classList.toggle(options.darkClass, nextIsDark);
        localStorage.setItem(options.themeKey, nextIsDark ? 'dark' : 'light');
        if (autoThemeTimer) {
          window.clearInterval(autoThemeTimer);
          autoThemeTimer = null;
        }
        setThemeButtonState(themeBtn, nextIsDark, options);
      });
    }

    return {
      isDark: () => document.body.classList.contains(options.darkClass),
      stopAutoRefresh: () => {
        if (!autoThemeTimer) return;
        window.clearInterval(autoThemeTimer);
        autoThemeTimer = null;
      }
    };
  }

  global.AncestrioTheme = {
    initThemeToggle,
    resolveInitialTheme,
    isNightTime
  };
})(window);
