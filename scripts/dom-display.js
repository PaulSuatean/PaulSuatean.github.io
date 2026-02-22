(function (global) {
  function resolveElement(target) {
    if (!target) return null;
    if (typeof target === 'string') {
      return document.getElementById(target);
    }
    return target;
  }

  function setDisplay(target, displayValue) {
    const el = resolveElement(target);
    if (!el) return null;
    el.style.display = displayValue;
    return el;
  }

  function show(target, displayValue = 'block') {
    return setDisplay(target, displayValue);
  }

  function hide(target) {
    return setDisplay(target, 'none');
  }

  function isInlineVisible(target) {
    const el = resolveElement(target);
    if (!el) return false;
    return el.style.display !== 'none';
  }

  function toggle(target, visible, displayValue = 'block') {
    return visible ? show(target, displayValue) : hide(target);
  }

  global.AncestrioDomDisplay = {
    resolveElement,
    setDisplay,
    show,
    hide,
    isInlineVisible,
    toggle
  };
})(window);
