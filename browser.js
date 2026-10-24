/* TV Browser for TizenBrew: a remote-controlled pointer, an address bar and a basic ad blocker.
   Injected into every page and frame at document start. ES5 only: Tizen 6 runs an older Chromium. */
(function () {
  'use strict';
  if (window.__tvBrowser) return;
  window.__tvBrowser = true;

  var HOME = 'https://fz-labz.github.io/tv-browser/';
  var SEARCH = 'https://duckduckgo.com/?q=';
  var TOP = window.top === window;
  var ui = {};

  /* ---------- Ad blocking ---------- */

  // Hosts of common ad, pop-under and tracking networks. A host matches itself and its subdomains.
  var AD_HOSTS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
    'pagead2.googlesyndication.com', 'googletagservices.com', 'amazon-adsystem.com', 'adnxs.com',
    'taboola.com', 'outbrain.com', 'criteo.com', 'criteo.net', 'pubmatic.com', 'rubiconproject.com',
    'openx.net', 'adform.net', 'smartadserver.com', 'casalemedia.com', 'yieldmo.com', 'media.net',
    'moatads.com', 'adsrvr.org', 'bidswitch.net', 'sharethrough.com', 'teads.tv', 'zedo.com',
    'revcontent.com', 'mgid.com', 'popads.net', 'popcash.net', 'propellerads.com', 'propellerclick.com',
    'adsterra.com', 'adsterratech.com', 'exoclick.com', 'exosrv.com', 'juicyads.com', 'onclickads.net',
    'onclckmn.com', 'hilltopads.net', 'hilltopads.com', 'a-ads.com', 'adcash.com', 'clickadu.com',
    'trafficjunky.net', 'trafficstars.com', 'adspyglass.com', 'popmyads.com', 'admaven.com',
    'ad-maven.com', 'richpush.co', 'pushame.com', 'monetag.com', 'galaksion.com', 'clickaine.com',
    'bidvertiser.com', 'infolinks.com', 'adsco.re', 'yllix.com', 'adskeeper.com', 'adskeeper.co.uk',
    'realsrv.com', 'tsyndicate.com', 'magsrv.com', 'acint.net', 'highperformanceformat.com',
    'profitablegatecpm.com', 'effectivecpmnetwork.com', 'effectiveratecpm.com', 'highcpmgate.com',
    'scorecardresearch.com', 'quantserve.com', 'zergnet.com', 'adition.com', 'serving-sys.com',
    'unrulymedia.com', 'spotxchange.com', 'springserve.com', 'imasdk.googleapis.com'
  ];

  var blocked = 0;

  function hostOf(url) {
    if (!url) return '';
    try { return new URL(String(url), location.href).hostname.toLowerCase(); } catch (e) { return ''; }
  }

  function isAdUrl(url) {
    var host = hostOf(url);
    if (!host) return false;
    for (var i = 0; i < AD_HOSTS.length; i++) {
      var d = AD_HOSTS[i];
      if (host === d || host.slice(-d.length - 1) === '.' + d) return true;
    }
    return false;
  }

  function noteBlocked(what, url) {
    blocked++;
    try { console.info('[tv-browser] blocked ' + what + ': ' + url); } catch (e) {}
    if (TOP && ui.count) ui.count.textContent = blocked;
    else if (!TOP) try { window.top.postMessage({ tvBrowserBlocked: 1 }, '*'); } catch (e) {}
  }

  // Scripts and frames from ad hosts never load.
  function guardElement(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag !== 'SCRIPT' && tag !== 'IFRAME' && tag !== 'IMG' && tag !== 'LINK' && tag !== 'EMBED' && tag !== 'OBJECT') return false;
    var src = el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('data') || '';
    if (!isAdUrl(src)) return false;
    if (tag === 'SCRIPT') el.type = 'javascript/blocked';
    el.removeAttribute('src');
    noteBlocked(tag.toLowerCase(), src);
    return true;
  }

  function patchInsert(proto, name) {
    var original = proto[name];
    if (!original) return;
    proto[name] = function () {
      for (var i = 0; i < arguments.length; i++) {
        var node = arguments[i];
        if (node && node.nodeType === 1 && guardElement(node)) {
          // Insert a harmless placeholder so callers that expect a return value don't fail.
          return node;
        }
      }
      return original.apply(this, arguments);
    };
  }
  patchInsert(Node.prototype, 'appendChild');
  patchInsert(Node.prototype, 'insertBefore');
  patchInsert(Node.prototype, 'replaceChild');
  if (window.Element) {
    patchInsert(Element.prototype, 'append');
    patchInsert(Element.prototype, 'prepend');
    patchInsert(Element.prototype, 'before');
    patchInsert(Element.prototype, 'after');
  }

  function patchSrc(Ctor) {
    if (!Ctor) return;
    var desc = Object.getOwnPropertyDescriptor(Ctor.prototype, 'src');
    if (!desc || !desc.set) return;
    Object.defineProperty(Ctor.prototype, 'src', {
      configurable: true, enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) {
        if (isAdUrl(value)) { noteBlocked('src', value); return; }
        desc.set.call(this, value);
      }
    });
  }
  patchSrc(window.HTMLScriptElement);
  patchSrc(window.HTMLIFrameElement);
  patchSrc(window.HTMLImageElement);

  var setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    var n = String(name).toLowerCase();
    if ((n === 'src' || n === 'href' || n === 'data') && /^(SCRIPT|IFRAME|IMG|EMBED|OBJECT)$/.test(this.tagName) && isAdUrl(value)) {
      noteBlocked(this.tagName.toLowerCase(), value);
      return;
    }
    return setAttribute.apply(this, arguments);
  };

  if (window.fetch) {
    var realFetch = window.fetch;
    window.fetch = function (input) {
      var url = input && input.url ? input.url : input;
      if (isAdUrl(url)) { noteBlocked('fetch', url); return Promise.reject(new TypeError('Blocked by tv-browser')); }
      return realFetch.apply(this, arguments);
    };
  }
  var xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (isAdUrl(url)) { noteBlocked('xhr', url); arguments[1] = 'about:blank'; }
    return xhrOpen.apply(this, arguments);
  };
  if (navigator.sendBeacon) {
    var beacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url) {
      if (isAdUrl(url)) { noteBlocked('beacon', url); return true; }
      return beacon.apply(navigator, arguments);
    };
  }

  // A TV has no tabs, so window.open is only ever a pop-up or pop-under. Our own UI never calls it.
  var fakeWindow = {
    closed: true, opener: null, location: { href: '' },
    focus: function () {}, blur: function () {}, close: function () {}, postMessage: function () {},
    document: { write: function () {}, writeln: function () {}, close: function () {}, open: function () {} }
  };
  window.open = function (url) { noteBlocked('pop-up', url || '(blank)'); return fakeWindow; };

  // Parser-inserted ad scripts and frames: neutralise them before they run.
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (guardElement(node) && node.parentNode) node.parentNode.removeChild(node);
        if (node.querySelectorAll) {
          var inner = node.querySelectorAll('script[src],iframe[src],img[src],embed[src],object[data]');
          for (var k = 0; k < inner.length; k++) if (guardElement(inner[k]) && inner[k].parentNode) inner[k].parentNode.removeChild(inner[k]);
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });

  // Element hiding for common ad slots, like a content blocker's generic cosmetic rules.
  var HIDE = [
    'ins.adsbygoogle', '[id^="google_ads_"]', '[id^="div-gpt-ad"]', '[id^="taboola-"]', '.OUTBRAIN',
    '.trc_related_container', 'iframe[src*="doubleclick.net"]', 'iframe[id^="google_ads_iframe"]',
    'a[href*="doubleclick.net"]', 'a[href*="popads.net"]', 'a[href*="propellerads.com"]',
    'a[href*="adsterra.com"]', 'a[href*="exoclick.com"]', '.adsbox', '.ad-banner', '.ad-container',
    '.ad-slot', '.ad-wrapper', '.adunit', '.advert', '.advertisement', '.sponsored-ad',
    '[data-ad-slot]', '[data-ad-unit]', '[aria-label="Advertisement"]', '#ad-banner', '#ad_banner'
  ];
  function injectHideStyle() {
    var style = document.createElement('style');
    style.textContent = HIDE.join(',\n') + ' { display: none !important; }';
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.documentElement) injectHideStyle();
  else document.addEventListener('DOMContentLoaded', injectHideStyle);

  // Links that would open a new tab open here instead; links to ad hosts go nowhere.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (isAdUrl(a.href)) { e.preventDefault(); e.stopImmediatePropagation(); noteBlocked('link', a.href); return; }
    if (a.target && a.target !== '_self' && /^https?:/.test(a.href)) { e.preventDefault(); location.href = a.href; }
  }, true);

  if (!TOP) return;

  /* ---------- Remote control UI (top window only) ---------- */

  var pointer = { x: 0, y: 0, visible: true, hideTimer: 0, held: 0, lastKey: 0 };
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 10009, BACK_ALT: 8, ESC: 27, CH_UP: 427, CH_DOWN: 428, PLAY_PAUSE: 10252, PLAY: 415, PAUSE: 19, RED: 403 };

  window.addEventListener('message', function (e) {
    if (e.data && e.data.tvBrowserBlocked) { blocked++; if (ui.count) ui.count.textContent = blocked; }
  });

  function el(tag, css, parent) {
    var node = document.createElement(tag);
    if (css) node.style.cssText = css;
    if (parent) parent.appendChild(node);
    return node;
  }

  function buildUI() {
    if (ui.root || !document.body) return;
    var root = ui.root = el('div', 'all:initial;position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:2147483647;font:500 22px/1.3 system-ui,sans-serif;');
    root.id = 'tv-browser-ui';
    ui.pointer = el('div', 'position:absolute;left:0;top:0;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:rgba(255,255,255,.9);border:3px solid #1a73e8;box-shadow:0 2px 10px rgba(0,0,0,.5);transition:opacity .3s;', root);
    var bar = ui.bar = el('div', 'position:absolute;left:40px;right:40px;top:24px;display:none;align-items:center;padding:14px 18px;border-radius:18px;background:rgba(20,20,24,.94);color:#fff;box-shadow:0 10px 40px rgba(0,0,0,.6);pointer-events:auto;', root);
    ui.input = el('input', 'flex:1;min-width:0;font:500 26px/1.2 system-ui,sans-serif;padding:12px 16px;border-radius:12px;border:2px solid #1a73e8;background:#fff;color:#111;outline:none;', bar);
    ui.input.type = 'url';
    ui.input.placeholder = 'Type a website or search';
    ui.input.setAttribute('autocomplete', 'off');
    var shield = el('span', 'white-space:nowrap;color:#9ad19a;margin-left:16px;', bar);
    shield.textContent = 'Blocked ';
    ui.count = el('b', '', shield);
    ui.count.textContent = blocked;
    var help = el('span', 'white-space:nowrap;color:#bbb;font-size:18px;margin-left:16px;', bar);
    help.textContent = 'OK go · Back close · CH▼ start page';
    ui.toast = el('div', 'position:absolute;left:50%;bottom:48px;transform:translateX(-50%);padding:12px 22px;border-radius:999px;background:rgba(20,20,24,.9);color:#fff;font-size:20px;opacity:0;transition:opacity .3s;', root);
    document.body.appendChild(root);
    ui.input.addEventListener('keydown', function (e) {
      if (e.keyCode === KEY.OK) { e.preventDefault(); go(ui.input.value); }
    });
    pointer.x = innerWidth / 2; pointer.y = innerHeight / 2;
    drawPointer();
  }

  function toast(text) {
    if (!ui.toast) return;
    ui.toast.textContent = text;
    ui.toast.style.opacity = 1;
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(function () { ui.toast.style.opacity = 0; }, 1800);
  }

  function normalise(text) {
    text = String(text || '').trim();
    if (!text) return '';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
    if (/^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(text) || /^localhost(:\d+)?/.test(text)) return 'https://' + text;
    return SEARCH + encodeURIComponent(text);
  }

  function go(text) {
    var url = normalise(text);
    if (!url) return;
    closeBar();
    location.href = url;
  }

  function openBar() {
    buildUI();
    ui.bar.style.display = 'flex';
    ui.input.value = location.href.indexOf(HOME) === 0 ? '' : location.href;
    ui.input.focus();
    ui.input.select();
  }

  function closeBar() {
    if (!ui.bar) return;
    ui.bar.style.display = 'none';
    if (document.activeElement === ui.input) ui.input.blur();
  }

  function barOpen() { return ui.bar && ui.bar.style.display !== 'none'; }

  function drawPointer() {
    if (!ui.pointer) return;
    ui.pointer.style.transform = 'translate(' + Math.round(pointer.x) + 'px,' + Math.round(pointer.y) + 'px)';
    ui.pointer.style.opacity = pointer.visible ? 1 : 0;
    clearTimeout(pointer.hideTimer);
    pointer.hideTimer = setTimeout(function () { pointer.visible = false; if (ui.pointer) ui.pointer.style.opacity = 0; }, 4000);
  }

  function scrollableAt(x, y, dy) {
    var node = document.elementFromPoint(x, y);
    while (node && node !== document.body && node !== document.documentElement) {
      var cs = getComputedStyle(node);
      if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 2) {
        if ((dy < 0 && node.scrollTop > 0) || (dy > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1)) return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function scrollBy(dy) {
    var target = scrollableAt(pointer.x, pointer.y, dy);
    if (target) target.scrollTop += dy;
    else window.scrollBy(0, dy);
  }

  function move(dx, dy) {
    var now = Date.now();
    pointer.held = now - pointer.lastKey < 150 ? Math.min(pointer.held + 1, 30) : 0;
    pointer.lastKey = now;
    var step = 14 + pointer.held * 3;
    var wasHidden = !pointer.visible;
    pointer.visible = true;
    if (wasHidden) { drawPointer(); return; }
    var nx = pointer.x + dx * step, ny = pointer.y + dy * step;
    var margin = 6;
    if (ny < margin) { scrollBy(ny - margin); ny = margin; }
    if (ny > innerHeight - margin) { scrollBy(ny - (innerHeight - margin)); ny = innerHeight - margin; }
    pointer.x = Math.max(margin, Math.min(innerWidth - margin, nx));
    pointer.y = ny;
    drawPointer();
  }

  function fire(target, type, x, y) {
    var init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: type.indexOf('down') >= 0 ? 1 : 0 };
    var ev;
    if (/^pointer/.test(type) && window.PointerEvent) { init.pointerId = 1; init.pointerType = 'mouse'; init.isPrimary = true; ev = new PointerEvent(type, init); }
    else ev = new MouseEvent(type.replace(/^pointer/, 'mouse'), init);
    target.dispatchEvent(ev);
  }

  function clickAt(x, y) {
    ui.root.style.display = 'none';
    var target = document.elementFromPoint(x, y);
    ui.root.style.display = '';
    if (!target) return;
    // Transparent click-jacking overlays that link to ad hosts are removed, then the click goes to what's underneath.
    var link = target.closest ? target.closest('a[href]') : null;
    if (link && isAdUrl(link.href)) {
      link.parentNode && link.parentNode.removeChild(link);
      noteBlocked('overlay', link.href);
      toast('Removed an ad overlay');
      return;
    }
    if (target.tagName === 'IFRAME' && isAdUrl(target.src)) {
      target.parentNode && target.parentNode.removeChild(target);
      noteBlocked('overlay', target.src);
      return;
    }
    fire(target, 'pointerdown', x, y); fire(target, 'mousedown', x, y);
    if (target.focus) try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    fire(target, 'pointerup', x, y); fire(target, 'mouseup', x, y);
    if (typeof target.click === 'function') target.click(); else fire(target, 'click', x, y);
  }

  function editing() {
    var a = document.activeElement;
    if (!a) return false;
    var tag = a.tagName;
    return tag === 'TEXTAREA' || a.isContentEditable || (tag === 'INPUT' && !/^(button|submit|checkbox|radio|range|color|file|image|reset)$/i.test(a.type));
  }

  function togglePlayback() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.readyState > 0) { if (v.paused) v.play(); else v.pause(); return true; }
    }
    return false;
  }

  window.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    buildUI();
    if (k === KEY.CH_UP || k === KEY.RED) { e.preventDefault(); e.stopImmediatePropagation(); openBar(); return; }
    if (k === KEY.CH_DOWN) { e.preventDefault(); e.stopImmediatePropagation(); location.href = HOME; return; }
    if (k === KEY.PLAY_PAUSE || k === KEY.PLAY || k === KEY.PAUSE) { if (togglePlayback()) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (k === KEY.BACK || k === KEY.BACK_ALT || k === KEY.ESC) {
      if (barOpen()) { e.preventDefault(); e.stopImmediatePropagation(); closeBar(); return; }
      if (editing()) { if (k === KEY.BACK_ALT) return; e.preventDefault(); e.stopImmediatePropagation(); document.activeElement.blur(); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      if (history.length > 1) history.back(); else location.href = HOME;
      return;
    }
    if (barOpen() || editing()) {
      // Up/down leave a text box; left/right stay with the caret.
      if (k === KEY.UP || k === KEY.DOWN) { if (barOpen()) return; document.activeElement.blur(); }
      else return;
    }
    var dx = 0, dy = 0;
    if (k === KEY.LEFT) dx = -1; else if (k === KEY.RIGHT) dx = 1; else if (k === KEY.UP) dy = -1; else if (k === KEY.DOWN) dy = 1;
    if (dx || dy) { e.preventDefault(); e.stopImmediatePropagation(); move(dx, dy); return; }
    if (k === KEY.OK) {
      if (!pointer.visible) { pointer.visible = true; drawPointer(); e.preventDefault(); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      clickAt(pointer.x, pointer.y);
    }
  }, true);

  if (document.body) buildUI();
  else document.addEventListener('DOMContentLoaded', buildUI);

  window.tvBrowser = { open: openBar, go: go, isAdUrl: isAdUrl, blocked: function () { return blocked; } };
})();
