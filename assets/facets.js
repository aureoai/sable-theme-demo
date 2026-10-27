(function () {
  'use strict';

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]';

  var globalBindings = [];
  var activeTrap = null;
  var activeClose = null;

  function remember(undo) {
    globalBindings.push(undo);
  }

  function releaseGlobals() {
    if (activeClose) {
      var closeIt = activeClose;
      activeClose = null;
      try { closeIt(); } catch (err) {  }
    }
    if (activeTrap) {
      document.removeEventListener('keydown', activeTrap, true);
      activeTrap = null;
    }
    while (globalBindings.length) {
      try { globalBindings.pop()(); } catch (err) {  }
    }
    document.documentElement.classList.remove('facets-open');
    Array.prototype.forEach.call(document.querySelectorAll('[data-facets]'), function (p) {
      p.__gsFacetsInit = false;
    });
  }

  function initFacets(panel) {

    if (panel.__gsFacetsInit) return;
    panel.__gsFacetsInit = true;

    var section = panel.closest('.shopify-section') || document;
    var toggle = section.querySelector('[data-facets-toggle]');
    var closeBtn = panel.querySelector('[data-facets-close]');
    if (!toggle) return;

    var isOpen = false;

    var mq = window.matchMedia('(min-width: 768px)');

    function applyWidth(isDesktop) {
      if (isDesktop) {
        if (isOpen) close(false);
        panel.classList.remove('facets--drawer');
        toggle.hidden = true;
      } else {
        panel.classList.add('facets--drawer');
        toggle.hidden = false;
      }
    }

    applyWidth(mq.matches);
    toggle.setAttribute('aria-expanded', 'false');

    if (!panel.id) panel.id = 'FacetsPanel';
    toggle.setAttribute('aria-controls', panel.id);

    function onKeydown(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== 'Tab') return;
      var items = Array.prototype.filter.call(
        panel.querySelectorAll(FOCUSABLE),
        function (el) { return el.offsetParent !== null || el === document.activeElement; }
      );
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    function open() {
      if (isOpen) return;

      if (mq.matches) return;
      isOpen = true;

      panel.classList.remove('is-closing');
      panel.classList.add('is-open');
      document.documentElement.classList.add('facets-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', onKeydown, true);
      activeTrap = onKeydown;
      activeClose = function () { close(false); };
      var target = closeBtn || panel.querySelector(FOCUSABLE);
      if (target) target.focus();
    }

    function settleClosed() {
      if (isOpen) return;
      panel.classList.remove('is-closing');
    }

    function close(returnFocus) {
      if (!isOpen) return;
      isOpen = false;
      panel.classList.remove('is-open');
      document.documentElement.classList.remove('facets-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown, true);
      if (activeTrap === onKeydown) activeTrap = null;
      activeClose = null;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        panel.classList.remove('is-closing');
      } else {
        panel.classList.add('is-closing');
        var done = function (event) {

          if (event && (event.target !== panel || event.propertyName !== 'transform')) return;
          panel.removeEventListener('transitionend', done);
          window.clearTimeout(timer);
          settleClosed();
        };
        var timer = window.setTimeout(function () {
          panel.removeEventListener('transitionend', done);
          settleClosed();
        }, 500);
        panel.addEventListener('transitionend', done);
      }

      if (returnFocus) toggle.focus();
    }

    var onToggle = function () { if (isOpen) { close(true); } else { open(); } };
    toggle.addEventListener('click', onToggle);
    remember(function () { toggle.removeEventListener('click', onToggle); });

    if (closeBtn) {
      var onClose = function () { close(true); };
      closeBtn.addEventListener('click', onClose);
      remember(function () { closeBtn.removeEventListener('click', onClose); });
    }

    var onChange = function (event) { applyWidth(event.matches); };
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      remember(function () { mq.removeEventListener('change', onChange); });
    } else if (mq.addListener) {
      mq.addListener(onChange);
      remember(function () { mq.removeListener(onChange); });
    }
  }

  function initAll() {
    releaseGlobals();
    Array.prototype.forEach.call(document.querySelectorAll('[data-facets]'), initFacets);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    if (!event.target.querySelector('[data-facets]')) return;
    releaseGlobals();
    initAll();
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (event.target.querySelector('[data-facets]')) releaseGlobals();
  });
})();
