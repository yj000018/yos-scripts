// ==UserScript==
// @name         YOS Archiver
// @version      2.2.0
// @description  Push, Archive, or Delete conversations from any LLM to YOS knowledge base.
// @author       Yannick Jolliet / Manus AI
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://perplexity.ai/*
// @match        https://manus.im/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @namespace    https://github.com/yj000018/yos-scripts
// @updateURL    https://raw.githubusercontent.com/yj000018/yos-scripts/main/yos-archiver.user.js
// @downloadURL  https://raw.githubusercontent.com/yj000018/yos-scripts/main/yos-archiver.user.js
// @supportURL   https://github.com/yj000018/yos-scripts/issues
// ==/UserScript==

(function () {
  'use strict';

  // ─── CONFIGURATION ──────────────────────────────────────────────────────────

  const CONFIG = {
    get endpointUrl() { return GM_getValue('yos_endpoint_url', 'https://yos-archiver-endpoint.fly.dev/api'); },
    get yosApiKey()   { return GM_getValue('yos_api_key', 'yos-4a43cb42f754b233a3fc458e3213ddcfc6805454'); },
  };

  // ─── DESIGN SYSTEM — YOS Dark + Purple ──────────────────────────────────────

  const DS = {
    bg:        '#0d0d0f',
    bgPanel:   '#141418',
    bgCard:    '#1a1a22',
    bgHover:   '#22222e',
    border:    '#2a2a38',
    borderFocus: '#7c3aed',
    purple:    '#7c3aed',
    purpleLight:'#a78bfa',
    purpleDim: '#4c1d95',
    text:      '#e8e8f0',
    textMuted: '#8888a0',
    textDim:   '#555568',
    success:   '#22c55e',
    warning:   '#f59e0b',
    danger:    '#ef4444',
    white:     '#ffffff',
    radius:    '10px',
    radiusSm:  '6px',
    font:      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
    shadow:    '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)',
    shadowBtn: '0 2px 8px rgba(124,58,237,0.3)',
  };

  // ─── STYLES ─────────────────────────────────────────────────────────────────

  GM_addStyle(`
    /* ── YOS Root ── */
    #yos-root * { box-sizing: border-box; font-family: ${DS.font}; }

    /* ── Floating Button ── */
    #yos-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: ${DS.purple};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${DS.shadowBtn};
      transition: all 0.2s ease;
      outline: none;
    }
    #yos-fab:hover { background: ${DS.purpleLight}; transform: scale(1.08); }
    #yos-fab:active { transform: scale(0.96); }
    #yos-fab svg { width: 20px; height: 20px; fill: ${DS.white}; }

    /* ── Panel ── */
    #yos-panel {
      position: fixed;
      bottom: 80px;
      right: 24px;
      z-index: 999998;
      width: 340px;
      background: ${DS.bgPanel};
      border: 1px solid ${DS.border};
      border-radius: ${DS.radius};
      box-shadow: ${DS.shadow};
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: yos-slide-up 0.18s ease;
    }
    #yos-panel.open { display: flex; }
    @keyframes yos-slide-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Panel Header ── */
    #yos-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 12px;
      border-bottom: 1px solid ${DS.border};
      background: ${DS.bg};
    }
    #yos-header-left { display: flex; align-items: center; gap: 8px; }
    #yos-logo {
      width: 24px; height: 24px;
      background: ${DS.purple};
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: ${DS.white};
      letter-spacing: -0.5px;
    }
    #yos-title {
      font-size: 13px; font-weight: 600;
      color: ${DS.text}; letter-spacing: 0.3px;
    }
    #yos-source-badge {
      font-size: 10px; font-weight: 500;
      color: ${DS.purpleLight};
      background: ${DS.purpleDim};
      padding: 2px 7px; border-radius: 20px;
      letter-spacing: 0.3px;
    }
    #yos-close {
      background: none; border: none; cursor: pointer;
      color: ${DS.textDim}; padding: 4px; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s;
    }
    #yos-close:hover { color: ${DS.text}; }
    #yos-close svg { width: 14px; height: 14px; }

    /* ── Panel Body ── */
    #yos-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }

    /* ── Meta info ── */
    #yos-meta {
      background: ${DS.bgCard};
      border: 1px solid ${DS.border};
      border-radius: ${DS.radiusSm};
      padding: 10px 12px;
      display: flex; flex-direction: column; gap: 4px;
    }
    #yos-conv-title {
      font-size: 12px; font-weight: 600;
      color: ${DS.text};
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #yos-conv-meta {
      font-size: 11px; color: ${DS.textMuted};
    }

    /* ── Action Buttons ── */
    #yos-actions { display: flex; flex-direction: column; gap: 6px; }

    .yos-btn {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px;
      border-radius: ${DS.radiusSm};
      border: 1px solid ${DS.border};
      background: ${DS.bgCard};
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
      width: 100%;
    }
    .yos-btn:hover { background: ${DS.bgHover}; border-color: ${DS.purple}; }
    .yos-btn-icon {
      width: 28px; height: 28px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 13px;
    }
    .yos-btn-text { display: flex; flex-direction: column; gap: 1px; }
    .yos-btn-label { font-size: 12px; font-weight: 600; color: ${DS.text}; }
    .yos-btn-desc  { font-size: 10px; color: ${DS.textMuted}; }

    /* Button variants */
    .yos-btn-push .yos-btn-icon   { background: rgba(124,58,237,0.2); }
    .yos-btn-archive .yos-btn-icon { background: rgba(136,136,160,0.15); }
    .yos-btn-both .yos-btn-icon    { background: rgba(124,58,237,0.35); }
    .yos-btn-delete .yos-btn-icon  { background: rgba(239,68,68,0.15); }
    .yos-btn-delete:hover { border-color: ${DS.danger}; }
    .yos-btn-delete .yos-btn-label { color: ${DS.danger}; }

    /* ── Status / Feedback ── */
    #yos-status {
      padding: 8px 12px;
      border-radius: ${DS.radiusSm};
      font-size: 11px; font-weight: 500;
      display: none; align-items: center; gap: 8px;
    }
    #yos-status.show { display: flex; }
    #yos-status.loading { background: rgba(124,58,237,0.1); color: ${DS.purpleLight}; border: 1px solid ${DS.purpleDim}; }
    #yos-status.success { background: rgba(34,197,94,0.1); color: ${DS.success}; border: 1px solid rgba(34,197,94,0.3); }
    #yos-status.error   { background: rgba(239,68,68,0.1); color: ${DS.danger}; border: 1px solid rgba(239,68,68,0.3); }

    .yos-spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid ${DS.purpleDim};
      border-top-color: ${DS.purpleLight};
      animation: yos-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes yos-spin { to { transform: rotate(360deg); } }

    /* ── Notion Link ── */
    #yos-notion-link {
      display: none; align-items: center; gap: 6px;
      padding: 8px 12px;
      background: ${DS.bgCard};
      border: 1px solid ${DS.border};
      border-radius: ${DS.radiusSm};
      font-size: 11px; color: ${DS.purpleLight};
      text-decoration: none;
      transition: border-color 0.15s;
    }
    #yos-notion-link.show { display: flex; }
    #yos-notion-link:hover { border-color: ${DS.purple}; }
    #yos-notion-link svg { width: 12px; height: 12px; fill: currentColor; flex-shrink: 0; }

    /* ── Confirm Delete Dialog ── */
    #yos-confirm {
      display: none; flex-direction: column; gap: 10px;
      padding: 12px;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: ${DS.radiusSm};
    }
    #yos-confirm.show { display: flex; }
    #yos-confirm-text { font-size: 12px; color: ${DS.text}; }
    #yos-confirm-btns { display: flex; gap: 8px; }
    .yos-confirm-btn {
      flex: 1; padding: 7px; border-radius: ${DS.radiusSm};
      border: none; cursor: pointer; font-size: 11px; font-weight: 600;
      transition: opacity 0.15s;
    }
    .yos-confirm-btn:hover { opacity: 0.85; }
    #yos-confirm-yes { background: ${DS.danger}; color: ${DS.white}; }
    #yos-confirm-no  { background: ${DS.bgHover}; color: ${DS.textMuted}; border: 1px solid ${DS.border}; }

    /* ── Panel Footer ── */
    #yos-footer {
      padding: 8px 16px;
      border-top: 1px solid ${DS.border};
      display: flex; align-items: center; justify-content: space-between;
    }
    #yos-footer-version { font-size: 10px; color: ${DS.textDim}; }
    #yos-footer-settings {
      font-size: 10px; color: ${DS.textDim};
      cursor: pointer; background: none; border: none; padding: 0;
      transition: color 0.15s;
    }
    #yos-footer-settings:hover { color: ${DS.purpleLight}; }

    /* ── Session Badges (sidebar) ── */
    .yos-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 9px; font-weight: 600; letter-spacing: 0.4px;
      padding: 2px 6px; border-radius: 20px;
      margin-left: 6px; vertical-align: middle;
      text-transform: uppercase;
    }
    .yos-badge-push    { background: ${DS.purpleDim}; color: ${DS.purpleLight}; }
    .yos-badge-archive { background: rgba(136,136,160,0.15); color: ${DS.textMuted}; }
    .yos-badge-both    { background: ${DS.purpleDim}; color: ${DS.purpleLight}; }
    .yos-badge-deleted { background: rgba(239,68,68,0.1); color: ${DS.danger}; text-decoration: line-through; }
  `);

  // ─── PLATFORM DETECTION ──────────────────────────────────────────────────────

  function detectPlatform() {
    const h = location.hostname;
    if (h.includes('chatgpt.com') || h.includes('chat.openai.com')) return 'chatgpt';
    if (h.includes('claude.ai'))    return 'claude';
    if (h.includes('gemini.google')) return 'gemini';
    if (h.includes('perplexity.ai')) return 'perplexity';
    if (h.includes('manus.im'))     return 'manus';
    return 'other';
  }

  // ─── CONTENT EXTRACTION ──────────────────────────────────────────────────────

  function extractConversation() {
    const platform = detectPlatform();
    let title = document.title.replace(/ - (ChatGPT|Claude|Gemini|Perplexity|Manus).*/, '').trim();
    let turns = [];

    const selectors = {
      chatgpt:    '[data-message-author-role]',
      claude:     '.human-turn, .ai-turn, [data-testid="human-turn"], [data-testid="ai-turn"]',
      gemini:     '.user-query, .model-response, .query-text, .response-container',
      perplexity: '.prose, [class*="answer"], [class*="question"]',
      manus:      '[class*="message"], [class*="chat"]',
      other:      'p, [class*="message"]',
    };

    const sel = selectors[platform] || selectors.other;
    document.querySelectorAll(sel).forEach(el => {
      const text = el.innerText?.trim();
      if (text && text.length > 10) turns.push(text);
    });

    // Fallback: body text
    if (turns.length === 0) {
      const body = document.body.innerText.trim();
      if (body.length > 50) turns.push(body.substring(0, 15000));
    }

    return {
      title: title || 'Untitled Conversation',
      url: location.href,
      source: platform.charAt(0).toUpperCase() + platform.slice(1),
      platform,
      content_full: turns.join('\n\n---\n\n').substring(0, 40000),
      turn_count: turns.length,
    };
  }

  // ─── CONVERSATION ID (for badge persistence) ─────────────────────────────────

  function getConvId() {
    const m = location.pathname.match(/\/([a-z0-9-]{8,})/i);
    return m ? m[1] : location.href;
  }

  // ─── API CALL ────────────────────────────────────────────────────────────────

  function callYOS(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${CONFIG.endpointUrl}/archive`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.yosApiKey}`,
        },
        data: JSON.stringify(payload),
        timeout: 45000,
        onload: (r) => {
          try {
            const d = JSON.parse(r.responseText);
            if (r.status >= 200 && r.status < 300) resolve(d);
            else reject(new Error(d.detail || `HTTP ${r.status}`));
          } catch (e) { reject(new Error('Invalid response')); }
        },
        onerror:   () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout — endpoint trop lent')),
      });
    });
  }

  // ─── BADGE MANAGEMENT ────────────────────────────────────────────────────────

  function saveBadge(convId, type) {
    const badges = JSON.parse(GM_getValue('yos_badges', '{}'));
    badges[convId] = { type, ts: Date.now() };
    GM_setValue('yos_badges', JSON.stringify(badges));
  }

  function getBadge(convId) {
    const badges = JSON.parse(GM_getValue('yos_badges', '{}'));
    return badges[convId] || null;
  }

  function applyBadges() {
    const badges = JSON.parse(GM_getValue('yos_badges', '{}'));
    const platform = detectPlatform();
    const sidebarSels = {
      chatgpt:    'nav [class*="truncate"], nav a span',
      claude:     '[class*="ConversationItem"], [class*="sidebar"] a span',
      gemini:     '[class*="conversation-title"]',
      perplexity: '[class*="thread"] span',
      manus:      '[class*="session"] span, [class*="task"] span',
    };
    const sel = sidebarSels[platform];
    if (!sel) return;
    document.querySelectorAll(sel).forEach(el => {
      if (el.querySelector('.yos-badge')) return;
      const link = el.closest('a') || el.closest('[href]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const m = href.match(/\/([a-z0-9-]{8,})/i);
      if (!m) return;
      const badge = badges[m[1]];
      if (!badge) return;
      const labels = { push: 'YOS', archive: 'Archive', both: 'YOS', deleted: 'Deleted' };
      const span = document.createElement('span');
      span.className = `yos-badge yos-badge-${badge.type}`;
      span.textContent = labels[badge.type] || badge.type;
      el.appendChild(span);
    });
  }

  // ─── UI CONSTRUCTION ─────────────────────────────────────────────────────────

  function buildUI() {
    if (document.getElementById('yos-root')) return;

    const root = document.createElement('div');
    root.id = 'yos-root';

    // FAB Button
    root.innerHTML = `
      <button id="yos-fab" title="YOS Archiver">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </button>

      <div id="yos-panel">
        <div id="yos-header">
          <div id="yos-header-left">
            <div id="yos-logo">Y</div>
            <span id="yos-title">YOS Archiver</span>
            <span id="yos-source-badge">—</span>
          </div>
          <button id="yos-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div id="yos-body">
          <div id="yos-meta">
            <div id="yos-conv-title">—</div>
            <div id="yos-conv-meta">—</div>
          </div>

          <div id="yos-actions">
            <button class="yos-btn yos-btn-push" data-action="push">
              <div class="yos-btn-icon">⚡</div>
              <div class="yos-btn-text">
                <span class="yos-btn-label">Push to YOS</span>
                <span class="yos-btn-desc">Extraire insights → mémoire active</span>
              </div>
            </button>
            <button class="yos-btn yos-btn-archive" data-action="archive">
              <div class="yos-btn-icon">📦</div>
              <div class="yos-btn-text">
                <span class="yos-btn-label">Archive only</span>
                <span class="yos-btn-desc">Verbatim + résumé → YOS Archives</span>
              </div>
            </button>
            <button class="yos-btn yos-btn-both" data-action="push+archive">
              <div class="yos-btn-icon">✦</div>
              <div class="yos-btn-text">
                <span class="yos-btn-label">Push + Archive</span>
                <span class="yos-btn-desc">Insights + verbatim liés</span>
              </div>
            </button>
            <button class="yos-btn yos-btn-delete" data-action="delete">
              <div class="yos-btn-icon">🗑</div>
              <div class="yos-btn-text">
                <span class="yos-btn-label">Delete</span>
                <span class="yos-btn-desc">Masquer — rien n'est conservé</span>
              </div>
            </button>
          </div>

          <div id="yos-confirm">
            <div id="yos-confirm-text">Supprimer définitivement cette session ? Aucune donnée ne sera conservée.</div>
            <div id="yos-confirm-btns">
              <button class="yos-confirm-btn" id="yos-confirm-yes">Supprimer</button>
              <button class="yos-confirm-btn" id="yos-confirm-no">Annuler</button>
            </div>
          </div>

          <div id="yos-status"></div>

          <a id="yos-notion-link" href="#" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z" opacity=".2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
            Voir dans Notion →
          </a>
        </div>

        <div id="yos-footer">
          <span id="yos-footer-version">YOS Archiver v2.2</span>
          <button id="yos-footer-settings">⚙ Paramètres</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    bindEvents();
  }

  // ─── EVENT BINDING ───────────────────────────────────────────────────────────

  function bindEvents() {
    const fab     = document.getElementById('yos-fab');
    const panel   = document.getElementById('yos-panel');
    const closeBtn = document.getElementById('yos-close');
    const status  = document.getElementById('yos-status');
    const notionLink = document.getElementById('yos-notion-link');
    const confirm = document.getElementById('yos-confirm');
    const confirmYes = document.getElementById('yos-confirm-yes');
    const confirmNo  = document.getElementById('yos-confirm-no');

    let currentConv = null;

    // Open panel
    fab.addEventListener('click', () => {
      currentConv = extractConversation();
      document.getElementById('yos-source-badge').textContent = currentConv.source;
      document.getElementById('yos-conv-title').textContent = currentConv.title;
      document.getElementById('yos-conv-meta').textContent =
        `${currentConv.turn_count} échanges · ${currentConv.platform}`;
      // Reset state
      setStatus('', '');
      notionLink.classList.remove('show');
      confirm.classList.remove('show');
      panel.classList.toggle('open');
    });

    // Close panel
    closeBtn.addEventListener('click', () => panel.classList.remove('open'));
    document.addEventListener('click', (e) => {
      if (!document.getElementById('yos-root').contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    // Action buttons
    document.querySelectorAll('.yos-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'delete') {
          confirm.classList.add('show');
          return;
        }
        await executeAction(action, currentConv);
      });
    });

    // Confirm delete
    confirmYes.addEventListener('click', () => {
      confirm.classList.remove('show');
      executeDelete(currentConv);
    });
    confirmNo.addEventListener('click', () => confirm.classList.remove('show'));

    // Settings
    document.getElementById('yos-footer-settings').addEventListener('click', openSettings);
  }

  // ─── EXECUTE ACTION ──────────────────────────────────────────────────────────

  async function executeAction(action, conv) {
    const status = document.getElementById('yos-status');
    const notionLink = document.getElementById('yos-notion-link');
    const labels = { push: 'Push to YOS', archive: 'Archivage', 'push+archive': 'Push + Archive' };

    setStatus('loading', `${labels[action]}…`);
    notionLink.classList.remove('show');

    try {
      const payload = {
        title: conv.title,
        url: conv.url,
        source: conv.source,
        action: action,
        content_full: conv.content_full,
        turn_count: conv.turn_count,
        tags: ['yOS'],
      };

      const result = await callYOS(payload);
      const badgeType = action === 'push+archive' ? 'both' : action;
      saveBadge(getConvId(), badgeType);
      applyBadges();

      setStatus('success', `✓ ${labels[action]} réussi`);

      if (result.notion_page_url) {
        notionLink.href = result.notion_page_url;
        notionLink.classList.add('show');
      }

      // Auto-close after 3s
      setTimeout(() => {
        document.getElementById('yos-panel').classList.remove('open');
      }, 3000);

    } catch (err) {
      setStatus('error', `✗ Erreur : ${err.message}`);
    }
  }

  function executeDelete(conv) {
    saveBadge(getConvId(), 'deleted');
    applyBadges();
    setStatus('success', '✓ Session marquée comme supprimée');
    setTimeout(() => {
      document.getElementById('yos-panel').classList.remove('open');
    }, 2000);
  }

  // ─── STATUS HELPER ───────────────────────────────────────────────────────────

  function setStatus(type, msg) {
    const el = document.getElementById('yos-status');
    el.className = 'yos-status';
    el.innerHTML = '';
    if (!type) return;
    el.classList.add('show', type);
    if (type === 'loading') {
      el.innerHTML = `<div class="yos-spinner"></div><span>${msg}</span>`;
    } else {
      el.textContent = msg;
    }
  }

  // ─── SETTINGS ────────────────────────────────────────────────────────────────

  function openSettings() {
    const endpoint = prompt('Endpoint URL:', CONFIG.endpointUrl);
    if (endpoint !== null) GM_setValue('yos_endpoint_url', endpoint.trim());
    const key = prompt('YOS API Key:', CONFIG.yosApiKey);
    if (key !== null) GM_setValue('yos_api_key', key.trim());
  }

  // ─── MENU COMMANDS ───────────────────────────────────────────────────────────

  GM_registerMenuCommand('⚙ YOS Archiver: Paramètres', openSettings);
  GM_registerMenuCommand('🔄 Re-appliquer les badges', applyBadges);

  // ─── INIT ────────────────────────────────────────────────────────────────────

  function init() {
    buildUI();
    applyBadges();
    // Re-apply badges on SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(applyBadges, 800);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }

})();
