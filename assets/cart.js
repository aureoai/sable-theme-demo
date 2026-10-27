(function () {
  'use strict';

  var QUANTITY_DEBOUNCE_MS = 250;

  var SECTIONS = ['cart-icon-bubble'];
  var CART_PAGE_ID = null;

  function collectSections() {
    SECTIONS = ['cart-icon-bubble'];
    CART_PAGE_ID = null;
    if (document.querySelector('[data-cart-drawer]')) SECTIONS.push('cart-drawer');
    var page = document.querySelector('[data-cart-page-section]');
    if (page) {
      CART_PAGE_ID = page.getAttribute('data-cart-page-section');
      if (CART_PAGE_ID) SECTIONS.push(CART_PAGE_ID);
    }
  }

  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  var FOCUSABLE_VISIBLE = FOCUSABLE
    .split(',')
    .map(function (s) { return s + ':not([aria-hidden="true"])'; })
    .join(',');

  var SUPPORTS_INERT = 'inert' in HTMLElement.prototype;

  function root() {
    var r = window.Shopify && window.Shopify.routes && window.Shopify.routes.root;
    return r || '/';
  }

  function url(path) {
    return root() + path;
  }

  function stringFor(name, fallback) {
    var host = document.querySelector('[data-cart-strings]');
    if (!host) return fallback || null;
    var value = host.getAttribute('data-' + name);
    return value === null ? (fallback || null) : value;
  }

  function stringWithCount(name, count) {
    var template = stringFor(name, null);
    return template ? template.replace('[count]', count) : null;
  }

  function closestFrom(event, selector) {
    var node = event.target;
    if (!node || typeof node.closest !== 'function') return null;
    return node.closest(selector);
  }

  function announce(message) {
    if (!message) return;

    var liveRegion = null;
    if (Drawer.isOpen) liveRegion = document.querySelector('[data-cart-drawer-status]');
    if (!liveRegion) liveRegion = document.getElementById('CartStatus');
    if (!liveRegion) return;

    liveRegion.textContent = '';
    window.setTimeout(function () {
      liveRegion.textContent = message;
    }, 0);
  }

  function post(path, body, isFormData) {
    var options = { method: 'POST', body: body };
    if (!isFormData) {

      options.headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    } else {
      options.headers = { Accept: 'application/json' };
    }

    return fetch(url(path), options)
      .then(function (response) {
        return response
          .json()
          .catch(function () { return null; })
          .then(function (data) {
            return { response: response, data: data };
          });
      })
      .then(function (result) {
        var data = result.data || {};

        var failed = !result.response.ok || typeof data.description === 'string';
        return {
          ok: !failed,
          data: data,
          message: data.description || null,
          sections: data.sections || null
        };
      })
      .catch(function (error) {

        if (window.console && console.warn) console.warn('[theme] cart request failed', error);
        return { ok: false, data: {}, message: stringFor('error-network', null), sections: null, network: true };
      });
  }

  var CART_ERROR_BOXES = '[data-cart-drawer] [data-cart-error], [data-cart-page] [data-cart-error]';

  function showCartError(message) {
    Array.prototype.forEach.call(document.querySelectorAll(CART_ERROR_BOXES), function (box) {
      if (message) {
        box.textContent = message;
        box.hidden = false;
      } else {
        box.textContent = '';
        box.hidden = true;
      }
    });
  }

  function sectionParams() {
    return {
      sections: SECTIONS.join(','),

      sections_url: window.location.pathname
    };
  }

  function sectionInner(html) {
    if (typeof html !== 'string') return null;
    var parsed = new DOMParser().parseFromString(html, 'text/html');

    var wrapper = parsed.querySelector('.shopify-section');
    return wrapper ? wrapper : parsed.body;
  }

  function applySections(sections) {
    if (!sections) return;

    var bubbleHtml = sections['cart-icon-bubble'];
    var bubbleTarget = document.querySelector('[data-cart-bubble]');
    if (bubbleHtml && bubbleTarget) {
      var bubble = sectionInner(bubbleHtml);
      if (bubble) bubbleTarget.innerHTML = bubble.innerHTML;
    }

    swapInner(sections['cart-drawer'], '[data-cart-drawer-inner]', 'CartDrawerTitle');

    if (CART_PAGE_ID) {
      swapInner(sections[CART_PAGE_ID], '[data-cart-page-inner]', 'CartPageTitle');
    }
  }

  function swapInner(html, selector, fallbackId) {
    if (!html) return;
    var target = document.querySelector(selector);
    if (!target) return;
    var parsed = sectionInner(html);
    var fresh = parsed && parsed.querySelector(selector);
    if (!fresh) return;
    var restore = captureFocusIntent(target, fallbackId);
    var restoreNote = captureNote(target);
    target.innerHTML = fresh.innerHTML;
    restoreNote();
    restore();
  }

  function captureFocusIntent(container, fallbackId) {
    var active = document.activeElement;
    if (!active || !container.contains(active)) return function () {};

    var line = typeof active.closest === 'function' ? active.closest('[data-line-key]') : null;
    var key = line ? line.getAttribute('data-line-key') : null;
    var step = active.getAttribute ? active.getAttribute('data-quantity-step') : null;
    var isInput = active.hasAttribute && active.hasAttribute('data-quantity-input');
    var isRemove = active.hasAttribute && active.hasAttribute('data-cart-remove');

    var isNote = active.hasAttribute && active.hasAttribute('data-cart-note');

    return function () {
      var target = null;
      if (isNote) target = container.querySelector('[data-cart-note]');
      if (!target && key) {
        var selector = '[data-line-key="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]';
        var freshLine = container.querySelector('[data-cart-line]' + selector);
        if (freshLine) {
          if (step) target = freshLine.querySelector('[data-quantity-step="' + step + '"]:not([aria-disabled="true"])');
          if (!target && isInput) target = freshLine.querySelector('[data-quantity-input]');
          if (!target && isRemove) target = freshLine.querySelector('[data-cart-remove]');

          if (!target) target = freshLine.querySelector('[data-quantity-input]');

          if (!target) target = freshLine.querySelector(FOCUSABLE_VISIBLE);
        }
      }
      if (!target) target = document.getElementById(fallbackId || 'CartDrawerTitle');
      if (target && typeof target.focus === 'function') target.focus();
    };
  }

  var Drawer = {
    el: null,
    opener: null,
    isOpen: false,
    scrollY: 0,

    reset: function () {
      if (!this.isOpen) return;
      this.isOpen = false;
      document.documentElement.classList.remove('cart-drawer-open');
      this.setBackgroundInert(false);
      document.removeEventListener('keydown', this.onKeydown, true);
      this.unlockScroll();
      this.opener = null;
    },

    init: function () {
      this.reset();

      this.el = document.querySelector('[data-cart-drawer]');
      if (!this.el) return;

      var self = this;
      var overlay = this.el.querySelector('[data-cart-overlay]');
      if (overlay) overlay.addEventListener('click', function () { self.close(); });

      this.el.addEventListener('click', function (event) {
        if (closestFrom(event, '[data-cart-close]')) self.close();
      });
    },

    open: function (opener) {
      if (!this.el || this.isOpen) return;
      this.isOpen = true;
      this.opener = opener || document.activeElement;

      this.el.hidden = false;

      void this.el.offsetWidth;

      document.documentElement.classList.add('cart-drawer-open');
      this.lockScroll();
      this.setBackgroundInert(true);

      var title = document.getElementById('CartDrawerTitle');
      if (title) title.focus();

      document.addEventListener('keydown', this.onKeydown, true);
    },

    close: function () {
      if (!this.el || !this.isOpen) return;
      this.isOpen = false;

      document.documentElement.classList.remove('cart-drawer-open');
      this.setBackgroundInert(false);
      document.removeEventListener('keydown', this.onKeydown, true);

      var el = this.el;
      var self = this;
      var done = function () {
        if (!self.isOpen) el.hidden = true;
        el.removeEventListener('transitionend', done);
      };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        done();
      } else {
        el.addEventListener('transitionend', done);
        window.setTimeout(done, 500);
      }

      this.unlockScroll();

      var target = this.opener;
      if (!target || !document.contains(target) || typeof target.focus !== 'function') {
        target = document.querySelector('[data-cart-bubble]');
      }
      if (target) target.focus();
      this.opener = null;
    },

    onKeydown: function (event) {
      if (event.key !== 'Escape' && event.key !== 'Esc') {
        Drawer.trapTab(event);
        return;
      }
      event.preventDefault();
      Drawer.close();
    },

    trapTab: function (event) {
      if (SUPPORTS_INERT || event.key !== 'Tab' || !Drawer.el) return;
      var items = Array.prototype.filter.call(
        Drawer.el.querySelectorAll(FOCUSABLE),
        function (el) { return el.offsetParent !== null; }
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
      } else if (!Drawer.el.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    },

    setBackgroundInert: function (on) {
      if (!SUPPORTS_INERT || !this.el) return;
      var self = this;
      Array.prototype.forEach.call(document.body.children, function (child) {

        if (child === self.el || child.contains(self.el)) return;
        if (child.hasAttribute('data-cart-no-inert')) return;
        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') return;
        if (on) {
          child.setAttribute('inert', '');
        } else {
          child.removeAttribute('inert');
        }
      });
    },

    lockScroll: function () {
      this.scrollY = window.scrollY || window.pageYOffset || 0;
      var body = document.body;
      body.style.position = 'fixed';
      body.style.top = -this.scrollY + 'px';
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
    },

    unlockScroll: function () {
      var body = document.body;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      window.scrollTo(0, this.scrollY);
    },

    autoOpens: function () {
      return this.el && this.el.getAttribute('data-auto-open') === 'true';
    }
  };

  function setButtonBusy(button, busy) {
    if (!button) return;
    var label = button.querySelector('[data-add-to-cart-label]');
    if (busy) {
      button.setAttribute('aria-busy', 'true');
      if (label) label.textContent = button.getAttribute('data-label-busy') || label.textContent;
    } else {
      button.removeAttribute('aria-busy');

      if (label && !button.disabled) {
        label.textContent = button.getAttribute('data-label-idle') || label.textContent;
      }
    }
  }

  function showFormSuccess(form, message) {
    var box = form.querySelector('[data-product-success]');
    if (!box) return false;
    if (message) {
      var text = box.querySelector('[data-product-success-text]') || box;

      box.hidden = false;
      if (text !== box) text.textContent = '';
      window.setTimeout(function () {
        text.textContent = message;
      }, 0);
    } else {
      box.hidden = true;
    }
    return !!message;
  }

  function showFormError(form, message) {
    var box = form.querySelector('[data-product-error], [data-cart-error]');
    if (!box) {
      announce(message);
      return;
    }
    if (message) {
      box.textContent = message;
      box.hidden = false;
    } else {
      box.textContent = '';
      box.hidden = true;
    }
  }

  function onAddSubmit(event) {
    var form = closestFrom(event, 'form[action*="/cart/add"]');
    if (!form) return;

    event.preventDefault();

    var button = form.querySelector('[data-add-to-cart]') || form.querySelector('[type="submit"]');
    if (button && button.getAttribute('aria-busy') === 'true') return;
    showFormError(form, null);
    showFormSuccess(form, null);
    setButtonBusy(button, true);

    var body = new FormData(form);
    var params = sectionParams();
    body.append('sections', params.sections);
    body.append('sections_url', params.sections_url);

    var seq = ++requestSeq;

    post('cart/add.js', body, true).then(function (result) {
      setButtonBusy(button, false);

      if (seq === requestSeq) applySections(result.sections);

      if (!result.ok) {
        showFormError(form, result.message || stringFor('error-generic', null));
        showCartError(null);

        if (!result.sections && !result.network) refreshSections();
        return;
      }

      var opensDrawer = Drawer.autoOpens() && Drawer.el;
      if (opensDrawer) {

        Drawer.open(button);
      } else {

        if (!showFormSuccess(form, stringFor('added', null))) {
          announce(stringFor('added', null));
        }
      }
    });
  }

  function refreshSections() {
    fetch(window.location.pathname + '?sections=' + SECTIONS.join(','), {
      headers: { Accept: 'application/json' }
    })
      .then(function (r) { return r.json(); })
      .then(applySections)
      .catch(function () {  });
  }

  var pending = {};
  var requestSeq = 0;

  function changeLine(key, quantity, origin) {
    if (!key) return;

    if (pending[key]) {
      window.clearTimeout(pending[key]);
      delete pending[key];
    }

    var line = origin ? origin.closest('[data-cart-line]') : null;
    var control = line ? line.querySelector('[data-quantity]') : null;
    if (control) control.setAttribute('aria-busy', 'true');

    var seq = ++requestSeq;
    var params = sectionParams();
    var body = JSON.stringify({
      id: key,
      quantity: quantity,
      sections: params.sections,
      sections_url: params.sections_url
    });

    post('cart/change.js', body, false).then(function (result) {

      if (control) control.removeAttribute('aria-busy');

      if (!result.ok) {
        var message = result.message || stringFor('error-generic', null);
        showCartError(message);
        announce(message);
        if (!result.sections && !result.network) refreshSections();
        return;
      }

      showCartError(null);
      if (seq !== requestSeq) return;
      applySections(result.sections);

      if (quantity === 0) {
        announce(stringFor('removed', null));
      } else {
        announce(stringFor('updated', null));
      }
    });
  }

  function queueChange(key, quantity, origin) {
    if (pending[key]) window.clearTimeout(pending[key]);
    pending[key] = window.setTimeout(function () {
      delete pending[key];
      changeLine(key, quantity, origin);
    }, QUANTITY_DEBOUNCE_MS);
  }

  function clampToInput(input, next) {
    var min = parseInt(input.getAttribute('min'), 10);
    var max = parseInt(input.getAttribute('max'), 10);
    if (!isNaN(min) && next < min) next = min;
    if (!isNaN(max) && next > max) next = max;
    return next;
  }

  function onQuantityClick(event) {
    var button = closestFrom(event, '[data-quantity-step]');
    if (!button) return;
    event.preventDefault();
    if (button.getAttribute('aria-disabled') === 'true') return;

    var control = button.closest('[data-quantity]');
    var input = control && control.querySelector('[data-quantity-input]');
    if (!input) return;

    var step = parseInt(button.getAttribute('data-quantity-step'), 10) || 0;
    var current = parseInt(input.value, 10);
    if (isNaN(current)) current = parseInt(input.getAttribute('min'), 10) || 1;

    var next = clampToInput(input, current + step);
    if (next === current) return;

    input.value = next;
    syncStepperState(control, next, input);

    var key = control.getAttribute('data-line-key');
    if (key) {
      queueChange(key, next, button);
    } else {

      announce(stringWithCount('quantity-announce', next));
    }
  }

  function syncStepperState(control, value, input) {
    var min = parseInt(input.getAttribute('min'), 10);
    var max = parseInt(input.getAttribute('max'), 10);
    var down = control.querySelector('[data-quantity-step="-1"]');
    var up = control.querySelector('[data-quantity-step="1"]');
    if (down) {
      if (!isNaN(min) && value <= min) {
        down.setAttribute('aria-disabled', 'true');
      } else {
        down.removeAttribute('aria-disabled');
      }
    }
    if (up) {
      if (!isNaN(max) && value >= max) {
        up.setAttribute('aria-disabled', 'true');
      } else {
        up.removeAttribute('aria-disabled');
      }
    }
  }

  function onQuantityChange(event) {
    var input = closestFrom(event, '[data-quantity-input]');
    if (!input) return;
    var control = input.closest('[data-quantity]');
    if (!control) return;

    var value = parseInt(input.value, 10);
    if (isNaN(value)) value = parseInt(input.getAttribute('min'), 10) || 1;
    value = clampToInput(input, value);
    input.value = value;
    syncStepperState(control, value, input);

    var key = control.getAttribute('data-line-key');
    if (key) queueChange(key, value, input);
  }

  var noteDirty = false;

  function onNoteInput(event) {
    if (closestFrom(event, '[data-cart-note]')) noteDirty = true;
  }

  function onNoteChange(event) {
    var field = closestFrom(event, '[data-cart-note]');
    if (!field) return;
    var value = field.value;
    post('cart/update.js', JSON.stringify({ note: value }), false).then(function (result) {
      if (!result.ok) {
        showCartError(result.message || stringFor('error-generic', null));
        return;
      }

      if (field.value === value) noteDirty = false;
      showCartError(null);
      announce(stringFor('note-saved', null));
    });
  }

  function captureNote(container) {
    var field = container.querySelector('[data-cart-note]');
    if (!field || !noteDirty) return function () {};
    var value = field.value;
    return function () {
      var fresh = container.querySelector('[data-cart-note]');
      if (fresh) fresh.value = value;
    };
  }

  function onRemoveClick(event) {
    var link = closestFrom(event, '[data-cart-remove]');
    if (!link) return;
    event.preventDefault();
    var key = link.getAttribute('data-line-key');
    if (!key) {
      window.location.href = link.href;
      return;
    }
    changeLine(key, 0, link);
  }

  function onOpenerClick(event) {
    var trigger = closestFrom(event, '[data-cart-bubble]');
    if (!trigger || !Drawer.el) return;

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    Drawer.open(trigger);
  }

  function init() {
    collectSections();
    Drawer.init();

    document.documentElement.classList.add('cart-js');

    document.addEventListener('submit', onAddSubmit);
    document.addEventListener('click', onOpenerClick);
    document.addEventListener('click', onQuantityClick);
    document.addEventListener('click', onRemoveClick);
    document.addEventListener('change', onQuantityChange);
    document.addEventListener('input', onNoteInput);
    document.addEventListener('change', onNoteChange);

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (event) {
    collectSections();
    if (event.target.querySelector('[data-cart-drawer]')) Drawer.init();
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (event.target.querySelector('[data-cart-drawer]')) {
      Drawer.reset();
      Drawer.el = null;
    }
  });

  window.theme = window.theme || {};
  window.theme.cart = {
    open: function () { Drawer.open(document.activeElement); },
    close: function () { Drawer.close(); },
    refresh: refreshSections
  };
})();
