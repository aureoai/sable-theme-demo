(function () {
  'use strict';

  function init(root) {
    if (!root || root.dataset.gsProductBound === 'true') return;
    root.dataset.gsProductBound = 'true';

    initVariants(root);
    initGallery(root);
  }

  function initVariants(root) {
    var dataEl = root.querySelector('[data-variant-data]');
    var picker = root.querySelector('[data-variant-picker]');
    if (!dataEl) return;

    var variants;
    try {
      variants = JSON.parse(dataEl.textContent);
    } catch (error) {
      if (window.console && console.warn) console.warn('[theme] variant data is not valid JSON', error);
      return;
    }
    if (!Array.isArray(variants) || !variants.length) return;

    var form = root.querySelector('[data-product-form]');
    var variantInput = root.querySelector('[data-variant-input]');
    var addButton = root.querySelector('[data-add-to-cart]');

    function selectedOptions() {
      if (!picker) return [];
      var checked = picker.querySelectorAll('.variant-picker__input:checked');
      var values = [];
      Array.prototype.forEach.call(checked, function (input) {
        var position = parseInt(input.getAttribute('data-option-position'), 10);
        values[position - 1] = input.value;
      });
      return values;
    }

    function matches(variant, values) {
      if (!variant.options) return false;
      for (var i = 0; i < values.length; i++) {
        if (values[i] === undefined) continue;
        if (variant.options[i] !== values[i]) return false;
      }
      return true;
    }

    function findVariant(values) {
      for (var i = 0; i < variants.length; i++) {
        if (matches(variants[i], values)) return variants[i];
      }
      return null;
    }

    function refreshAvailability(values) {
      if (!picker) return;
      var inputs = picker.querySelectorAll('.variant-picker__input');
      Array.prototype.forEach.call(inputs, function (input) {
        var position = parseInt(input.getAttribute('data-option-position'), 10);
        var probe = values.slice();
        probe[position - 1] = input.value;

        var available = false;
        for (var i = 0; i < variants.length; i++) {
          if (variants[i].available && matches(variants[i], probe)) {
            available = true;
            break;
          }
        }

        var label = picker.querySelector('label[for="' + input.id + '"]');
        if (available) {
          input.removeAttribute('data-unavailable');
          if (label) label.classList.remove('variant-picker__value--unavailable');
        } else {
          input.setAttribute('data-unavailable', 'true');
          if (label) label.classList.add('variant-picker__value--unavailable');
        }

        if (label) {
          var note = label.querySelector('[data-unavailable-note]');
          if (!available && !note) {
            note = document.createElement('span');
            note.className = 'visually-hidden';
            note.setAttribute('data-unavailable-note', '');
            note.textContent = ' ' + (root.getAttribute('data-string-unavailable') || '');
            label.appendChild(note);
          } else if (available && note) {
            note.parentNode.removeChild(note);
          }
        }
      });
    }

    function updateLegends() {
      if (!picker) return;
      var checked = picker.querySelectorAll('.variant-picker__input:checked');
      Array.prototype.forEach.call(checked, function (input) {
        var position = input.getAttribute('data-option-position');
        var out = picker.querySelector('[data-option-value-for="' + position + '"]');
        if (out) out.textContent = input.value;
      });
    }

    function updatePrice(variant) {
      var current = root.querySelector('[data-price-current]');
      var compareWrap = root.querySelector('[data-price-compare-wrap]');
      var compare = root.querySelector('[data-price-compare]');
      var saleLabel = root.querySelector('[data-price-label-sale]');
      if (!current) return;

      current.innerHTML = variant.price;

      var onSale = !!variant.compare_at_price;
      if (compare && variant.compare_at_price) compare.innerHTML = variant.compare_at_price;
      if (compareWrap) compareWrap.hidden = !onSale;
      if (saleLabel) saleLabel.hidden = !onSale;
    }

    function updateButton(variant) {
      if (!addButton) return;
      var label = addButton.querySelector('[data-add-to-cart-label]');
      var buyable = !!(variant && variant.available);

      addButton.disabled = !buyable;
      if (label) {

        var next;
        if (buyable) {
          next = addButton.getAttribute('data-label-idle');
        } else if (variant) {
          next = addButton.getAttribute('data-label-sold-out');
        } else {
          next = addButton.getAttribute('data-label-unavailable')
            || addButton.getAttribute('data-label-sold-out');
        }
        label.textContent = next || label.textContent;
      }

      if (variantInput) {
        variantInput.value = variant ? variant.id : '';
        variantInput.disabled = !buyable;
      }
    }

    function updateQuantityRule(variant) {
      var input = root.querySelector('[data-quantity-input]');
      if (!input) return;
      var control = input.closest('[data-quantity]');
      var rule = (variant && variant.quantity_rule) || null;
      var min = rule && rule.min ? rule.min : 1;
      var step = rule && rule.increment ? rule.increment : 1;

      input.setAttribute('min', min);
      input.setAttribute('step', step);
      if (rule && rule.max) {
        input.setAttribute('max', rule.max);
      } else {
        input.removeAttribute('max');
      }

      var value = parseInt(input.value, 10);
      if (isNaN(value) || value < min) value = min;
      if (rule && rule.max && value > rule.max) value = rule.max;
      input.value = value;

      if (control) input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function updateSkuRow(variant) {
      var row = root.querySelector('[data-variant-sku-row]');
      if (!row) return;
      var has = !!(variant && variant.sku);
      if (has) {
        row.removeAttribute('hidden');
      } else {
        row.setAttribute('hidden', '');
      }
    }

    function updateLowStock(variant) {
      var line = root.querySelector('[data-low-stock]');
      if (!line) return;
      if (variant && variant.low_stock) {
        line.removeAttribute('hidden');
      } else {
        line.setAttribute('hidden', '');
      }
    }

    function updateSku(variant) {
      var sku = root.querySelector('[data-variant-sku]');
      if (sku) sku.textContent = variant && variant.sku ? variant.sku : '';
    }

    function updateUrl(variant) {
      if (!variant || !window.history || !window.history.replaceState) return;

      try {
        var next = new URL(window.location.href);
        next.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', next.toString());
      } catch (error) {

      }
    }

    function updateMedia(variant) {
      if (!variant || variant.media_id === null || variant.media_id === undefined) return;
      var gallery = root.querySelector('[data-product-gallery]');
      if (!gallery) return;
      var slide = gallery.querySelector('[data-media-id="' + variant.media_id + '"]');
      if (slide) showSlide(gallery, slide, false);
    }

    function onChange() {
      var values = selectedOptions();
      var variant = findVariant(values);

      updateLegends();
      refreshAvailability(values);
      updateButton(variant);
      updateSkuRow(variant);
      updateLowStock(variant);
      updateSku(variant);
      updateUrl(variant);
      updateMedia(variant);

      if (variant) {
        updatePrice(variant);
        updateQuantityRule(variant);
      } else if (addButton) {
        addButton.disabled = true;
      }
    }

    if (picker) picker.addEventListener('change', onChange);

    refreshAvailability(selectedOptions());

    if (form) {
      form.addEventListener('submit', function (event) {
        if (variantInput && (variantInput.disabled || !variantInput.value)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
    }
  }

  function showSlide(gallery, slide, smooth) {
    var viewport = gallery.querySelector('[data-gallery-viewport]');
    if (!viewport || !slide) return;

    Array.prototype.forEach.call(gallery.querySelectorAll('.product-gallery__slide'), function (el) {
      el.classList.toggle('is-active', el === slide);
    });

    var id = slide.getAttribute('data-media-id');
    Array.prototype.forEach.call(gallery.querySelectorAll('[data-gallery-thumb]'), function (thumb) {
      var on = thumb.getAttribute('data-media-id') === id;
      thumb.classList.toggle('is-active', on);
      if (on) {
        thumb.setAttribute('aria-current', 'true');
      } else {
        thumb.removeAttribute('aria-current');
      }
    });

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var behavior = smooth && !reduced ? 'smooth' : 'auto';

    if (viewport.scrollWidth > viewport.clientWidth + 1) {

      viewport.scrollTo({ left: slide.offsetLeft - viewport.offsetLeft, behavior: behavior });
    } else if (smooth) {
      slide.scrollIntoView({ behavior: behavior, block: 'nearest' });
    }
  }

  function initGallery(root) {
    var gallery = root.querySelector('[data-product-gallery]');
    if (!gallery) return;

    var viewport = gallery.querySelector('[data-gallery-viewport]');
    var rail = gallery.querySelector('[data-gallery-rail]');

    if (rail) {
      rail.addEventListener('click', function (event) {
        var thumb = event.target && typeof event.target.closest === 'function'
          ? event.target.closest('[data-gallery-thumb]')
          : null;
        if (!thumb) return;

        event.preventDefault();
        var slide = gallery.querySelector(
          '.product-gallery__slide[data-media-id="' + thumb.getAttribute('data-media-id') + '"]'
        );
        showSlide(gallery, slide, true);
      });
    }

    var active = gallery.querySelector('.product-gallery__slide.is-active');
    var first = gallery.querySelector('.product-gallery__slide');
    if (active && first && active !== first) showSlide(gallery, active, false);

    if (viewport && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
            var id = entry.target.getAttribute('data-media-id');
            Array.prototype.forEach.call(gallery.querySelectorAll('[data-gallery-thumb]'), function (thumb) {
              var on = thumb.getAttribute('data-media-id') === id;
              thumb.classList.toggle('is-active', on);
              if (on) {
                thumb.setAttribute('aria-current', 'true');
              } else {
                thumb.removeAttribute('aria-current');
              }
            });
          });
        },
        { root: viewport, threshold: [0.6] }
      );
      Array.prototype.forEach.call(gallery.querySelectorAll('.product-gallery__slide'), function (slide) {
        observer.observe(slide);
      });
    }
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-main-product]'), init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var product = event.target.querySelector('[data-main-product]');
    if (product) init(product);
  });
})();
