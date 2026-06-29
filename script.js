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

  function runURL(url) {
    if (state.isLoading) return;
    state.isLoading = true;
    dom.btnOpen.disabled = true;
    dom.btnStop.disabled = false;

    showLoading();

    let settled = false;

    function settle(success, message) {
      if (settled) return;
      settled = true;
      state.isLoading = false;
      dom.progressBar.style.width = '100%';

      // Clean up handlers so stale loads don't re-trigger
      dom.iframe.onload = null;
      dom.iframe.onerror = null;

      setTimeout(() => {
        if (success) {
          showFrame();
          addToHistory(url);
        } else {
          showError(
            'Load Failed',
            message || 'The page could not be loaded. It may block iframe embedding (X-Frame-Options / CSP).'
          );
        }
        dom.btnOpen.disabled = false;
        dom.btnStop.disabled = true;
      }, 250);
    }

    // Attach handlers BEFORE setting src to avoid race condition
    dom.iframe.onload = () => {
      // Give browser a moment to finalize, then consider it loaded.
      // If the site blocks iframe embedding, onload still fires
      // but the iframe shows an error page — we show it anyway
      // since there is no JS-accessible way to detect that cross-origin.
      setTimeout(() => settle(true), 400);
    };

    dom.iframe.onerror = () => {
      settle(false, 'Network error — could not reach the URL.');
    };

    // Now assign src (handlers are already listening)
    dom.iframe.src = url;

    // Start phased loading animation
    const phases = [
      { text: 'Connecting...',      pct: 18,  delay: 350 },
      { text: 'Resolving host...',  pct: 35,  delay: 300 },
      { text: 'Loading content...', pct: 60,  delay: 400 },
      { text: 'Rendering view...',  pct: 85,  delay: 350 },
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

    // Timeout — generous 20s for slow connections
    setTimeout(() => {
      if (!settled) settle(false, 'Request timed out after 20 seconds. The site may be slow or blocking iframe embedding.');
    }, 20000);
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
