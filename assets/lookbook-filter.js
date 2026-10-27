(function () {
  'use strict';

  var ALL = 'all';

  function chipsOf(root) {
    return Array.prototype.slice.call(root.querySelectorAll('[data-look-chip]'));
  }

  function cardsOf(root) {
    var grid = root.querySelector('[data-lookbook-grid]');
    return grid ? Array.prototype.slice.call(grid.children) : [];
  }

  function apply(root, category) {
    var shown = 0;
    cardsOf(root).forEach(function (card) {
      var cat = card.getAttribute('data-look-category');
      var show = category === ALL || cat === category;
      if (show) {
        card.removeAttribute('hidden');
        shown += 1;
      } else {
        card.setAttribute('hidden', '');
      }
    });

    chipsOf(root).forEach(function (chip) {
      var on = chip.getAttribute('data-look-chip') === category;
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    root.setAttribute('data-lookbook-active', category);
    return shown;
  }

  function announce(root, shown) {
    var region = root.querySelector('[data-lookbook-status]');
    if (!region) return;
    var template = region.getAttribute('data-lookbook-status') || '';
    var message = template
      ? template.replace('[count]', String(shown))
      : String(shown);
    region.textContent = '';
    window.setTimeout(function () {
      region.textContent = message;
    }, 0);
  }

  function init(root) {
    if (!root || root.__lookbookFilter) return;
    var filter = root.querySelector('[data-lookbook-filter]');
    var grid = root.querySelector('[data-lookbook-grid]');
    if (!filter || !grid) return;
    root.__lookbookFilter = true;

    filter.removeAttribute('hidden');

    filter.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('[data-look-chip]') : null;
      if (!chip || !filter.contains(chip)) return;
      var category = chip.getAttribute('data-look-chip');
      if (root.getAttribute('data-lookbook-active') === category) return;
      announce(root, apply(root, category));
    });

    apply(root, ALL);
  }

  function initAll(scope) {
    var roots = (scope || document).querySelectorAll('.lookbook');
    Array.prototype.forEach.call(roots, init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); });
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });

  function resetFor(node) {
    if (!node) return;
    var root = node.closest ? node.closest('.lookbook') : null;
    if (!root) return;
    if (root.getAttribute('data-lookbook-active') !== ALL) apply(root, ALL);
  }

  document.addEventListener('shopify:block:select', function (event) {
    resetFor(event.target);
  });

  document.addEventListener('shopify:section:select', function (event) {
    resetFor(event.target);
  });
})();
