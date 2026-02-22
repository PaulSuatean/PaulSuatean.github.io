(function () {
  window.AncestrioTheme?.initThemeToggle({ persistInitialTheme: true });

  const container = document.querySelector('.triangle-container');
  const leftTriangle = document.querySelector('.triangle-left');
  const rightTriangle = document.querySelector('.triangle-right');
  const bottomTriangle = document.querySelector('.triangle-bottom');

  function clearHoverClasses() {
    container?.classList.remove('hover-left', 'hover-right', 'hover-bottom');
  }

  leftTriangle?.addEventListener('mouseenter', () => {
    clearHoverClasses();
    container?.classList.add('hover-left');
  });
  leftTriangle?.addEventListener('mouseleave', () => {
    container?.classList.remove('hover-left');
  });

  rightTriangle?.addEventListener('mouseenter', () => {
    clearHoverClasses();
    container?.classList.add('hover-right');
  });
  rightTriangle?.addEventListener('mouseleave', () => {
    container?.classList.remove('hover-right');
  });

  bottomTriangle?.addEventListener('mouseenter', () => {
    clearHoverClasses();
    container?.classList.add('hover-bottom');
  });
  bottomTriangle?.addEventListener('mouseleave', () => {
    container?.classList.remove('hover-bottom');
  });
})();
