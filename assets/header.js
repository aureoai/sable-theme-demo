(function () {
  'use strict';

  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function initHeader(header) {

    if (header.__gsHeaderInit) return;
    header.__gsHeaderInit = true;

    var toggle = header.querySelector('[data-menu-toggle]');
    var panel = header.querySelector('[data-menu-panel]');
    var overlay = header.querySelector('[data-menu-overlay]');
    var closeBtn = header.querySelector('[data-menu-close]');
    if (!toggle || !panel) return;

    var isOpen = false;
    var lastFocused = null;

    function focusable() {
      return Array.prototype.filter.call(
        panel.querySelectorAll(FOCUSABLE),
        function (el) { return el.offsetParent !== null; }
      );
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      lastFocused = document.activeElement;

      panel.hidden = false;
      if (overlay) overlay.hidden = false;

      void panel.offsetWidth;

      header.classList.add('header--menu-open');
      document.documentElement.classList.add('menu-open');
      toggle.setAttribute('aria-expanded', 'true');

      var first = focusable()[0];
      if (first) first.focus();

      document.addEventListener('keydown', onKeydown, true);
      activeTrap = onKeydown;
      activeClose = function () { close(false); };
    }

    function close(returnFocus) {
      if (!isOpen) return;
      isOpen = false;

      header.classList.remove('header--menu-open');
      document.documentElement.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');

      document.removeEventListener('keydown', onKeydown, true);
      if (activeTrap === onKeydown) activeTrap = null;
      activeClose = null;

      var done = function () {
        if (!isOpen) {
          panel.hidden = true;
          if (overlay) overlay.hidden = true;
        }
        panel.removeEventListener('transitionend', done);
      };

      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        done();
      } else {
        panel.addEventListener('transitionend', done);

        window.setTimeout(done, 400);
      }

      if (returnFocus !== false) {
        var target = toggle;
        if (
          lastFocused &&
          typeof lastFocused.focus === 'function' &&
          lastFocused !== document.body &&
          document.contains(lastFocused)
        ) {
          target = lastFocused;
        }
        target.focus();
      }
    }

    function onKeydown(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== 'Tab') return;

      var items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
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

    var onToggle = function () { if (isOpen) { close(true); } else { open(); } };
    toggle.addEventListener('click', onToggle);
    remember(function () { toggle.removeEventListener('click', onToggle); });

    if (closeBtn) {
      var onCloseBtn = function () { close(true); };
      closeBtn.addEventListener('click', onCloseBtn);
      remember(function () { closeBtn.removeEventListener('click', onCloseBtn); });
    }
    if (overlay) {
      var onOverlay = function () { close(true); };
      overlay.addEventListener('click', onOverlay);
      remember(function () { overlay.removeEventListener('click', onOverlay); });
    }

    var searchTrigger = header.querySelector('[data-search-trigger]');
    var searchPanel = header.querySelector('[data-search-panel]');

    if (searchTrigger && searchPanel) {
      var searchInput = searchPanel.querySelector('[data-search-input]');
      var searchClose = searchPanel.querySelector('[data-search-close]');
      var searchOpen = false;

      searchTrigger.setAttribute('aria-haspopup', 'dialog');
      searchTrigger.setAttribute('aria-expanded', 'false');
      searchTrigger.setAttribute('aria-controls', searchPanel.id || 'HeaderSearch');

      var onSearchKeydown = function (event) {
        if (event.key !== 'Escape' && event.key !== 'Esc') return;
        event.preventDefault();
        closeSearch(true);
      };

      var openSearch = function () {
        if (searchOpen) return;
        searchOpen = true;
        searchPanel.hidden = false;
        header.classList.add('header--search-open');
        searchTrigger.setAttribute('aria-expanded', 'true');
        document.addEventListener('keydown', onSearchKeydown, true);
        activeSearchTrap = onSearchKeydown;
        activeSearchClose = function () { closeSearch(false); };
        if (searchInput) searchInput.focus();
      };

      closeSearch = function (returnFocus) {
        if (!searchOpen) return;
        searchOpen = false;
        searchPanel.hidden = true;
        header.classList.remove('header--search-open');
        searchTrigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', onSearchKeydown, true);
        if (activeSearchTrap === onSearchKeydown) activeSearchTrap = null;
        activeSearchClose = null;
        if (returnFocus) searchTrigger.focus();
      };

      var onSearchTrigger = function (event) {

        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
            event.button !== 0) return;
        event.preventDefault();
        if (searchOpen) { closeSearch(true); } else { openSearch(); }
      };
      searchTrigger.addEventListener('click', onSearchTrigger);
      remember(function () {
        searchTrigger.removeEventListener('click', onSearchTrigger);
      });

      if (searchClose) {
        var onSearchCloseClick = function () { closeSearch(true); };
        searchClose.addEventListener('click', onSearchCloseClick);
        remember(function () {
          searchClose.removeEventListener('click', onSearchCloseClick);
        });
      }
    }

    var mq = window.matchMedia('(min-width: 1024px)');
    var onChange = function (event) {
      if (event.matches && isOpen) close(false);
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      remember(function () { mq.removeEventListener('change', onChange); });
    } else if (mq.addListener) {
      mq.addListener(onChange);
      remember(function () { mq.removeListener(onChange); });
    }

    if (header.classList.contains('header--sticky')) {
      var onScroll = function () {
        header.classList.toggle('header--scrolled', window.scrollY > 8);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      remember(function () {
        window.removeEventListener('scroll', onScroll, { passive: true });
      });
    }
  }

  var globalBindings = [];
  var activeTrap = null;
  var activeClose = null;

  var activeSearchTrap = null;
  var activeSearchClose = null;
  var closeSearch = null;

  function remember(undo) {
    globalBindings.push(undo);
  }

  function releaseGlobals() {

    if (activeClose) {
      var closeIt = activeClose;
      activeClose = null;
      try { closeIt(); } catch (err) {  }
    }
    if (activeSearchClose) {
      var closeSearchIt = activeSearchClose;
      activeSearchClose = null;
      try { closeSearchIt(); } catch (err) {  }
    }
    if (activeTrap) {
      document.removeEventListener('keydown', activeTrap, true);
      activeTrap = null;
    }
    if (activeSearchTrap) {
      document.removeEventListener('keydown', activeSearchTrap, true);
      activeSearchTrap = null;
    }
    while (globalBindings.length) {
      try { globalBindings.pop()(); } catch (err) {  }
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-header]'), function (h) {
      h.__gsHeaderInit = false;
    });

    document.documentElement.classList.remove('menu-open');
  }

  function initAll() {
    releaseGlobals();
    Array.prototype.forEach.call(document.querySelectorAll('[data-header]'), initHeader);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var header = event.target.querySelector('[data-header]');
    if (!header) return;

    releaseGlobals();
    initHeader(header);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (event.target.querySelector('[data-header]')) releaseGlobals();
  });
})();
