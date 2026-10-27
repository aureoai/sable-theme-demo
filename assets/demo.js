/* Sable demo layer. Not part of the theme: tools/build_demo.py copies it into
   demo-site/ only. It adds the demo bar, the accent switcher, and a fetch shim
   so the cart drawer works with one line item on a static host. */
(function () {
  'use strict';

  var PALETTES = [
    { key: 'gold', label: 'Gold', accent: '#D8C08A', strong: '#82672B', hover: '#E6D3A6' },
    { key: 'silver', label: 'Silver', accent: '#C9C5BC', strong: '#5F5A50', hover: '#DEDAD2' },
    { key: 'red', label: 'Signal red', accent: '#EE6A55', strong: '#A5301E', hover: '#F4917F' },
    { key: 'sage', label: 'Sage', accent: '#AEBB93', strong: '#4B5443', hover: '#C6D0AF' },
    { key: 'cobalt', label: 'Cobalt', accent: '#93B4EA', strong: '#2E5594', hover: '#B6CCF1' },
    { key: 'orange', label: 'Orange', accent: '#F29A4A', strong: '#99470F', hover: '#F6B67C' }
  ];
  var PAGES = [
    ['index.html', 'Home'],
    ['collection.html', 'Collection'],
    ['product-everyday-tee.html', 'Product'],
    ['product-heavyweight-hoodie.html', 'Product on sale'],
    ['product-rib-beanie.html', 'Product sold out'],
    ['cart.html', 'Cart page'],
    ['search.html', 'Search results'],
    ['our-story.html', 'Content page'],
    ['404.html', '404 page']
  ];
  var MAX_QTY = 9;
  var LINE_KEY = 'sable-demo-line';
  // ?shot gives a clean page for listing screenshots: no bar, no toasts, every
  // image loaded eagerly. ?shot=cart also opens the drawer with one line.
  var shotMatch = window.location.search.match(/[?&]shot(?:=([\w-]+))?(?:&|$)/);
  var SHOT = shotMatch ? (shotMatch[1] || 'page') : '';

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function get(kind, key) {
    var s = store(kind);
    try { return s ? s.getItem(key) : null; } catch (e) { return null; }
  }
  function set(kind, key, value) {
    var s = store(kind);
    try {
      if (!s) return;
      if (value === null) s.removeItem(key); else s.setItem(key, value);
    } catch (e) { /* private mode: the demo still works, it just forgets */ }
  }

  // ------------------------------------------------------------ accent colour
  function applyAccent(key) {
    var p = PALETTES.filter(function (x) { return x.key === key; })[0] || PALETTES[0];
    var root = document.documentElement.style;
    root.setProperty('--palette-accent', p.accent);
    root.setProperty('--palette-accent-strong', p.strong);
    root.setProperty('--palette-accent-hover', p.hover);
    return p.key;
  }
  var accent = applyAccent(get('localStorage', 'sable-demo-accent') || 'gold');

  // -------------------------------------------------------------------- toast
  var toastTimer = null;
  function toast(message) {
    if (SHOT) return;
    var el = document.getElementById('demo-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-toast';
      el.className = 'demo-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('is-visible'); }, 4200);
  }

  // ---------------------------------------------------------------- cart shim
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  var statesPromise = null;

  function states() {
    if (!statesPromise) {
      statesPromise = realFetch('assets/demo-cart.json').then(function (r) { return r.json(); });
    }
    return statesPromise;
  }

  function readLine() {
    try { return JSON.parse(get('sessionStorage', LINE_KEY)); } catch (e) { return null; }
  }
  function writeLine(line) {
    set('sessionStorage', LINE_KEY, line ? JSON.stringify(line) : null);
  }

  function money(cents) {
    return '$' + (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function scaled(base, q) {
    var out = {};
    ['cart-drawer', 'cart-icon-bubble'].forEach(function (id) {
      var doc = new DOMParser().parseFromString(base[id], 'text/html');
      var each = function (sel, fn) { Array.prototype.forEach.call(doc.querySelectorAll(sel), fn); };
      each('[data-quantity-input]', function (el) { el.setAttribute('value', String(q)); });
      each('[data-quantity-step="-1"]', function (el) {
        if (q > 1) el.removeAttribute('aria-disabled'); else el.setAttribute('aria-disabled', 'true');
      });
      each('[data-quantity-step="1"]', function (el) {
        if (q >= MAX_QTY) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
      });
      each('.cart-line__price-final', function (el) { el.textContent = money(base.price * q); });
      each('.cart-line__price-original', function (el) { el.textContent = money(base.compare * q); });
      each('.cart-totals dd', function (el) { el.textContent = money(base.price * q); });
      each('[data-cart-count]', function (el) { el.textContent = String(q); });
      each('[data-cart-count-text]', function (el) { el.textContent = q + (q === 1 ? ' item' : ' items'); });
      out[id] = doc.body.innerHTML;
    });
    return out;
  }

  function sectionsFor(line) {
    return states().then(function (s) {
      var base = line && s[line.v];
      if (!base) return { 'cart-drawer': s.empty['cart-drawer'], 'cart-icon-bubble': s.empty['cart-icon-bubble'] };
      return line.q === 1
        ? { 'cart-drawer': base['cart-drawer'], 'cart-icon-bubble': base['cart-icon-bubble'] }
        : scaled(base, line.q);
    });
  }

  function respond(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function onCartPage() {
    return document.body && document.body.classList.contains('template-cart');
  }

  function parseBody(body) {
    if (body && typeof FormData !== 'undefined' && body instanceof FormData) {
      return { id: body.get('id'), quantity: body.get('quantity') };
    }
    try { return JSON.parse(body); } catch (e) { return {}; }
  }

  function handleAdd(init) {
    var body = parseBody(init && init.body);
    var id = String(body.id || '');
    var qty = parseInt(body.quantity, 10) || 1;
    return states().then(function (s) {
      if (!s[id]) return respond({ status: 422, description: 'This item is sold out.' }, 422);
      var line = readLine();
      var q = qty;
      if (line && line.v === id) q = line.q + qty;
      else if (line) toast('The demo cart holds one item at a time, so your new pick replaced the last one.');
      if (q > MAX_QTY) {
        q = MAX_QTY;
        toast('The demo cart stops at ' + MAX_QTY + '. A live store follows your inventory.');
      }
      writeLine({ v: id, q: q });
      return sectionsFor(readLine()).then(function (sections) {
        return respond({ id: id, quantity: q, sections: sections });
      });
    });
  }

  function handleChange(init) {
    if (onCartPage()) {
      return Promise.resolve(respond({
        status: 422,
        description: 'Demo store: this cart page shows sample items, so editing is switched off here. The cart drawer on every other page works.'
      }, 422));
    }
    var body = parseBody(init && init.body);
    var line = readLine();
    var q = Math.max(0, Math.min(parseInt(body.quantity, 10) || 0, MAX_QTY));
    if (!line || q === 0) writeLine(null); else writeLine({ v: line.v, q: q });
    return sectionsFor(readLine()).then(function (sections) {
      return respond({ sections: sections });
    });
  }

  if (realFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (/\/cart\/add(\.js)?(\?|$)/.test(url)) return handleAdd(init);
      if (/\/cart\/change(\.js)?(\?|$)/.test(url)) return handleChange(init);
      if (/\/cart\/update(\.js)?(\?|$)/.test(url)) {
        return sectionsFor(readLine()).then(function (sections) { return respond({ sections: sections }); });
      }
      if (/[?&]sections=/.test(url)) return sectionsFor(readLine()).then(respond);
      return realFetch(input, init);
    };
  }

  // ------------------------------------------------------------------ demo bar
  function buildBar() {
    var here = (document.body.getAttribute('data-demo-page') || 'index') + '.html';
    var bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Theme demo controls');

    var brand = document.createElement('p');
    brand.className = 'demo-bar__brand';
    brand.innerHTML = '<strong>Sable</strong><span>Streetwear theme for Shopify &middot; demo store</span>';

    var nav = document.createElement('label');
    nav.className = 'demo-bar__pages';
    nav.innerHTML = '<span>Page</span>';
    var select = document.createElement('select');
    PAGES.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p[0];
      o.textContent = p[1];
      if (p[0] === here) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', function () { window.location.href = select.value; });
    nav.appendChild(select);

    var accents = document.createElement('div');
    accents.className = 'demo-bar__accents';
    accents.setAttribute('role', 'group');
    accents.setAttribute('aria-label', 'Accent colour');
    var label = document.createElement('span');
    label.textContent = 'Accent';
    accents.appendChild(label);
    PALETTES.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'demo-swatch';
      b.style.setProperty('--swatch', p.accent);
      b.setAttribute('aria-label', p.label);
      b.setAttribute('title', p.label);
      b.setAttribute('aria-pressed', p.key === accent ? 'true' : 'false');
      b.addEventListener('click', function () {
        accent = applyAccent(p.key);
        set('localStorage', 'sable-demo-accent', p.key);
        Array.prototype.forEach.call(accents.querySelectorAll('.demo-swatch'), function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
      });
      accents.appendChild(b);
    });

    var hide = document.createElement('button');
    hide.type = 'button';
    hide.className = 'demo-bar__hide';
    hide.textContent = 'Hide';

    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'demo-pill';
    pill.textContent = 'Demo';
    pill.setAttribute('aria-label', 'Show the demo bar');

    function show(visible) {
      bar.hidden = !visible;
      pill.hidden = visible;
      document.documentElement.classList.toggle('demo-bar-visible', visible);
      set('sessionStorage', 'sable-demo-bar', visible ? null : 'hidden');
    }
    hide.addEventListener('click', function () { show(false); pill.focus(); });
    pill.addEventListener('click', function () { show(true); hide.focus(); });

    bar.appendChild(brand);
    bar.appendChild(nav);
    bar.appendChild(accents);
    bar.appendChild(hide);
    document.body.appendChild(bar);
    document.body.appendChild(pill);
    show(get('sessionStorage', 'sable-demo-bar') !== 'hidden');
  }

  function explainUnavailable() {
    document.addEventListener('submit', function (event) {
      var by = event.submitter;
      if (by && by.name === 'checkout') {
        event.preventDefault();
        toast('Checkout is hosted by Shopify, so it is not part of this demo.');
      }
    }, true);
    document.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('shopify-account')) {
        toast('Customer accounts are hosted by Shopify and appear on a live store.');
      }
    });
    if (/[?&](filter\.|sort_by=)/.test(window.location.search)) {
      toast('Filtering and sorting run on Shopify. The demo shows every product.');
    }
  }

  function shotMode() {
    Array.prototype.forEach.call(document.querySelectorAll('img[loading="lazy"]'), function (i) {
      i.loading = 'eager';
    });
    if (SHOT === 'cart') {
      var id = document.querySelector('form[action*="/cart/add"] [name="id"]');
      if (id) writeLine({ v: id.value, q: 1 });
      window.setTimeout(function () {
        var cart = window.theme && window.theme.cart;
        if (!cart) return;
        cart.refresh();
        window.setTimeout(function () {
          cart.open();
          // the drawer focuses its title for keyboard users; a still image
          // should not show that ring
          if (document.activeElement) document.activeElement.blur();
        }, 400);
      }, 0);
    }
  }

  function onReady() {
    if (SHOT) {
      shotMode();
      return;
    }
    buildBar();
    explainUnavailable();
    if (readLine() && !onCartPage()) {
      // cart.js is deferred: let it bind first, then draw the saved line.
      window.setTimeout(function () {
        if (window.theme && window.theme.cart) window.theme.cart.refresh();
      }, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
