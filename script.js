/* ═══════════════════════════════════════════════════════════
   Neo Web Control Panel — Application Logic
   Zero-dependency, modular vanilla JavaScript.
   ═══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────── */

  /** Short alias for querySelector */
  const $ = (sel, root = document) => root.querySelector(sel);

  /** Sanitize a string for safe HTML insertion (XSS prevention) */
  function escapeHTML(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  /** Clamp a number between min and max */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /* ── DOM References ──────────────────────────────────── */

  const dom = {
    urlInput:       $('#url-input'),
    btnOpen:        $('#btn-open'),
    btnStop:        $('#btn-stop'),
    btnPaste:       $('#btn-paste'),
    btnCopy:        $('#btn-copy'),
    btnTheme:       $('#btn-theme'),
    btnHistory:     $('#btn-history'),
    btnClearHist:   $('#btn-clear-history'),
    btnRetry:       $('#btn-retry'),
    statusBar:      $('#status-bar'),
    statusText:     $('#status-text'),
    progressBar:    $('#progress-bar'),
    stateIdle:      $('#state-idle'),
    stateLoading:   $('#state-loading'),
    stateError:     $('#state-error'),
    stateFrame:     $('#state-frame'),
    errorTitle:     $('#error-title'),
    errorMsg:       $('#error-msg'),
    loaderText:     $('#loader-text'),
    iframe:         $('#viewer-iframe'),
    historyPanel:   $('#history-panel'),
    historyList:    $('#history-list'),
    historyEmpty:   $('#history-empty'),
    historyOverlay: $('#history-overlay'),
    toastContainer: $('#toast-container'),
  };

  /* ── State ───────────────────────────────────────────── */

  const STORAGE_KEYS = {
    theme:   'neo_theme',
    history: 'neo_history',
  };

  const MAX_HISTORY = 10;

  let state = {
    isLoading:   false,
    historyOpen: false,
    history:     [],
  };

  /* ── Theme ───────────────────────────────────────────── */

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    const theme = saved === 'light' ? 'light' : 'dark';
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ── URL Normalization & Validation ──────────────────── */

  /**
   * Normalize a user-entered URL string.
   * Returns null if the URL is invalid.
   */
  function normalizeURL(raw) {
    if (!raw || typeof raw !== 'string') return null;

    let s = raw.trim().replace(/^["']+|["']+$/g, '');
    if (!s) return null;

    // Auto-prepend protocol
    if (!/^https?:\/\//i.test(s)) {
      s = 'https://' + s;
    }

    try {
      const url = new URL(s);
      // Only allow http/https
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.href;
    } catch {
      return null;
    }
  }

  /* ── Viewer State Management ─────────────────────────── */

  const viewerStates = ['stateIdle', 'stateLoading', 'stateError', 'stateFrame'];

  function showViewerState(activeKey) {
    viewerStates.forEach(key => {
      dom[key].classList.toggle('hidden', key !== activeKey);
    });
  }

  function resetViewer() {
    showViewerState('stateIdle');
    dom.statusBar.classList.add('hidden');
    dom.progressBar.style.width = '0%';
    // Reset iframe state
    dom.iframe.onload = null;
    dom.iframe.onerror = null;
    dom.iframe.src = 'about:blank';
  }

  function showLoading() {
    showViewerState('stateLoading');
    dom.statusBar.classList.remove('hidden');
    dom.progressBar.style.width = '0%';
    dom.statusText.textContent = 'Initializing...';
  }

  function showFrame() {
    showViewerState('stateFrame');
    dom.statusBar.classList.add('hidden');
  }

  function showError(title, message) {
    showViewerState('stateError');
    dom.statusBar.classList.add('hidden');
    dom.errorTitle.textContent = title;
    dom.errorMsg.textContent = message;
  }

  /* ── Typewriter Effect ───────────────────────────────── */

  function typewrite(el, text, speed = 22) {
    el.textContent = '';
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        el.textContent += text[i++];
        setTimeout(tick, speed);
      }
    };
    tick();
  }

  /* ── URL Loading ─────────────────────────────────────── */

  function openURL() {
    if (state.isLoading) return;

    const url = normalizeURL(dom.urlInput.value);
    if (!url) {
      showError('Invalid URL', 'Please enter a valid URL (e.g. https://example.com).');
      return;
    }

    dom.urlInput.value = url;
    runURL(url);
  }

  /* ── Proxy-based URL loading ────────────────────────── */

  const PROXY_SERVICES = [
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
  ];

  /**
   * Rewrite relative URLs in HTML to absolute ones so they
   * resolve correctly when loaded inside a blob/srcdoc iframe.
   */
  function rewriteRelativeURLs(html, baseURL) {
    let base;
    try { base = new URL(baseURL); } catch { return html; }

    const origin = base.origin;
    const pathname = base.pathname.replace(/\/[^/]*$/, '/');

    // <base href>
    html = html.replace(/(<base\s[^>]*href=["'])([^"']+)(["'])/i, '$1' + origin + pathname + '$3');

    // Rewrite src, href, poster, data, action attributes (skip data: and javascript: and http(s):)
    const attrPattern = /((?:src|href|poster|data|action)\s*=\s*["'])(?!data:|javascript:|https?:\/\/|#)([^"']+)(["'])/gi;
    html = html.replace(attrPattern, (match, prefix, path, suffix) => {
      if (path.startsWith('//')) return prefix + 'https:' + path + suffix;
      try {
        const resolved = new URL(path, base).href;
        return prefix + resolved + suffix;
      } catch {
        return match;
      }
    });

    // Rewrite url() in inline styles
    html = html.replace(/(url\(\s*["']?)(?!data:|javascript:|https?:\/\/|#)([^"')]+)(["']?\s*\))/gi, (match, prefix, path, suffix) => {
      try {
        return prefix + new URL(path, base).href + suffix;
      } catch {
        return match;
      }
    });

    return html;
  }

  /**
   * Add a <base> tag if none exists, so relative paths resolve
   * against the original site origin.
   */
  function ensureBaseTag(html, baseURL) {
    let base;
    try { base = new URL(baseURL); } catch { return html; }

    const origin = base.origin;
    const dirPath = base.pathname.replace(/\/[^/]*$/, '/');

    if (/<base\s/i.test(html)) return html;

    // Inject after <head> or at the very start
    const baseTag = `<base href="${origin}${dirPath}">`;
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/(<head[^>]*>)/i, '$1' + baseTag);
    }
    return baseTag + html;
  }

  /**
   * Fetch a URL through a CORS proxy and return the HTML text.
   */
  async function fetchViaProxy(url) {
    for (const proxy of PROXY_SERVICES) {
      try {
        const resp = await fetch(proxy + encodeURIComponent(url), {
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.length > 50) return text;
        }
      } catch {
        // try next proxy
      }
    }
    return null;
  }

  /**
   * Try direct fetch (works for CORS-friendly sites).
   */
  async function fetchDirect(url) {
    try {
      const resp = await fetch(url, {
        mode: 'cors',
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) return await resp.text();
    } catch {}
    return null;
  }

  function runURL(url) {
    if (state.isLoading) return;
    state.isLoading = true;
    dom.btnOpen.disabled = true;
    dom.btnStop.disabled = false;

    showLoading();

    let settled = false;
    let loadTimeout = null;

    function settle(success, message) {
      if (settled) return;
      settled = true;
      state.isLoading = false;
      clearTimeout(loadTimeout);
      dom.progressBar.style.width = '100%';

      dom.iframe.onload = null;
      dom.iframe.onerror = null;

      setTimeout(() => {
        if (success) {
          showFrame();
          addToHistory(url);
        } else {
          showError(
            'Load Failed',
            message || 'Could not load this site. It may block external access or be unreachable.'
          );
        }
        dom.btnOpen.disabled = false;
        dom.btnStop.disabled = true;
      }, 250);
    }

    // Phased loading animation
    const phases = [
      { text: 'Connecting...',      pct: 15,  delay: 300 },
      { text: 'Fetching content...',pct: 35,  delay: 400 },
      { text: 'Processing HTML...', pct: 60,  delay: 350 },
      { text: 'Rendering view...',  pct: 85,  delay: 300 },
    ];
    let phaseIndex = 0;
    const advancePhase = () => {
      if (phaseIndex >= phases.length || !state.isLoading) return;
      const p = phases[phaseIndex++];
      dom.statusText.textContent = p.text;
      dom.progressBar.style.width = p.pct + '%';
      typewrite(dom.loaderText, p.text);
      setTimeout(advancePhase, p.delay);
    };
    advancePhase();

    // Master timeout
    loadTimeout = setTimeout(() => {
      settle(false, 'Timed out — the site took too long to respond.');
    }, 18000);

    // ── Step 1: Try direct fetch first ──
    (async () => {
      let html = await fetchDirect(url);

      // ── Step 2: Fall back to proxy ──
      if (!html) {
        dom.statusText.textContent = 'Using proxy...';
        html = await fetchViaProxy(url);
      }

      if (!state.isLoading) return;

      if (!html) {
        settle(false, 'Could not fetch the page content. The site may be unreachable or blocking all access.');
        return;
      }

      // ── Step 3: Rewrite relative URLs and inject base tag ──
      html = ensureBaseTag(html, url);
      html = rewriteRelativeURLs(html, url);

      // ── Step 4: Strip frame-busting scripts ──
      html = html.replace(/<script[^>]*>[\s\S]*?(top|parent|self)\s*(!=|===?|!==?)\s*(self|top|parent)[\s\S]*?<\/script>/gi, '<!-- frame-buster removed -->');
      html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?X-Frame-Options["']?[^>]*>/gi, '');
      html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi, '');

      // ── Step 5: Load into iframe via blob URL ──
      dom.progressBar.style.width = '90%';

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobURL = URL.createObjectURL(blob);

      dom.iframe.onload = () => {
        URL.revokeObjectURL(blobURL);
        setTimeout(() => settle(true), 200);
      };

      dom.iframe.onerror = () => {
        URL.revokeObjectURL(blobURL);
        settle(false, 'Failed to render the page in the viewer.');
      };

      dom.iframe.src = blobURL;
    })();
  }

  function stopLoading() {
    if (!state.isLoading) return;
    state.isLoading = false;
    dom.iframe.onload = null;
    dom.iframe.onerror = null;
    dom.iframe.src = 'about:blank';
    resetViewer();
    dom.btnOpen.disabled = false;
    dom.btnStop.disabled = true;
  }

  /* ── History ─────────────────────────────────────────── */

  function loadHistory() {
    try {
      state.history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history)) || [];
      if (!Array.isArray(state.history)) state.history = [];
    } catch {
      state.history = [];
    }
    renderHistory();
  }

  function saveHistory() {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
  }

  function addToHistory(url) {
    state.history = state.history.filter(h => h.url !== url);
    state.history.unshift({ url, ts: Date.now() });
    if (state.history.length > MAX_HISTORY) {
      state.history = state.history.slice(0, MAX_HISTORY);
    }
    saveHistory();
    renderHistory();
  }

  function clearHistory() {
    state.history = [];
    saveHistory();
    renderHistory();
    showToast('History cleared');
  }

  function formatTimestamp(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000)    return 'now';
    if (diff < 3600000)  return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderHistory() {
    dom.historyList.innerHTML = '';
    dom.historyEmpty.classList.toggle('hidden', state.history.length > 0);

    const globeSVG = `<svg class="sidebar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

    state.history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'sidebar__item';
      li.setAttribute('role', 'listitem');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-label', escapeHTML(item.url));

      const display = item.url.replace(/^https?:\/\//, '');

      li.innerHTML =
        globeSVG +
        `<span class="sidebar__item-url" title="${escapeHTML(item.url)}">${escapeHTML(display)}</span>` +
        `<span class="sidebar__item-time">${formatTimestamp(item.ts)}</span>`;

      const activate = () => {
        dom.urlInput.value = item.url;
        closeHistory();
        runURL(item.url);
      };

      li.addEventListener('click', activate);
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });

      dom.historyList.appendChild(li);
    });
  }

  /* ── History Panel ───────────────────────────────────── */

  function toggleHistory() {
    state.historyOpen ? closeHistory() : openHistory();
  }

  function openHistory() {
    state.historyOpen = true;
    dom.historyPanel.classList.add('open');
    dom.historyOverlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => dom.historyOverlay.classList.add('visible'));
  }

  function closeHistory() {
    state.historyOpen = false;
    dom.historyPanel.classList.remove('open');
    dom.historyOverlay.classList.remove('visible');
    dom.historyOverlay.setAttribute('aria-hidden', 'true');
  }

  /* ── Clipboard ───────────────────────────────────────── */

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        dom.urlInput.value = text.trim();
        dom.urlInput.focus();
        showToast('Pasted from clipboard');
      }
    } catch {
      showToast('Clipboard access denied');
    }
  }

  async function copyToClipboard() {
    const url = normalizeURL(dom.urlInput.value);
    if (!url) {
      showToast('No valid URL to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('URL copied to clipboard');
    } catch {
      showToast('Copy failed');
    }
  }

  /* ── Toast Notifications ─────────────────────────────── */

  function showToast(message, duration = 2200) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    dom.toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* ── Event Binding ───────────────────────────────────── */

  function bindEvents() {
    dom.btnOpen.addEventListener('click', openURL);
    dom.btnStop.addEventListener('click', stopLoading);
    dom.btnRetry.addEventListener('click', openURL);
    dom.btnTheme.addEventListener('click', toggleTheme);
    dom.btnPaste.addEventListener('click', pasteFromClipboard);
    dom.btnCopy.addEventListener('click', copyToClipboard);
    dom.btnHistory.addEventListener('click', toggleHistory);
    dom.btnClearHist.addEventListener('click', clearHistory);

    dom.urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') openURL();
    });

    dom.historyOverlay.addEventListener('click', closeHistory);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.historyOpen) closeHistory();
    });
  }

  /* ── Particle Background ─────────────────────────────── */

  function initParticles() {
    const canvas = $('#particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let w, h;
    const particles = [];
    const COUNT = 55;
    const CONNECT_RADIUS = 140;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function seed() {
      particles.length = 0;
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x:  Math.random() * w,
          y:  Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r:  Math.random() * 1.4 + 0.4,
        });
      }
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const rgb = isDark ? '124,58,237' : '109,40,217';

      // Update & draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},0.3)`;
        ctx.fill();

        // Connect to neighbors
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_RADIUS) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${rgb},${0.07 * (1 - dist / CONNECT_RADIUS)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(frame);
    }

    resize();
    seed();
    frame();
    window.addEventListener('resize', () => { resize(); seed(); });
  }

  /* ── Boot ────────────────────────────────────────────── */

  function init() {
    initTheme();
    loadHistory();
    bindEvents();
    initParticles();
    dom.urlInput.focus();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
