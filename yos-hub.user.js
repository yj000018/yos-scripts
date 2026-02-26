// ==UserScript==
// @name         YOS Hub
// @version      3.2.0
// @description  YOS Hub universel — point d'entrée unique pour toutes les fonctionnalités YOS.
// @author       Yannick Jolliet / Manus AI
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @match        https://manus.im/*
// @namespace    https://github.com/yj000018/yos-scripts
// @updateURL    https://raw.githubusercontent.com/yj000018/yos-scripts/main/yos-hub.user.js
// @downloadURL  https://raw.githubusercontent.com/yj000018/yos-scripts/main/yos-hub.user.js
// @supportURL   https://github.com/yj000018/yos-scripts/issues
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// ==/UserScript==
(function () {
  'use strict';

  // ─── GUARD — unique root ID, no collision with YOS Archiver ─────────────────
  const ROOT_ID = 'yosh-root'; // "yosh-" prefix = YOS Hub, distinct from "yos-" (Archiver)

  // ─── CONFIG ──────────────────────────────────────────────────────────────────
  const API_ENDPOINT = 'https://yos-archiver-endpoint.fly.dev/api';
  const API_KEY      = 'yos-4a43cb42f754b233a3fc458e3213ddcfc6805454';

  // ─── DESIGN ──────────────────────────────────────────────────────────────────
  const C = {
    bg:      '#0d0d0f',
    panel:   '#141418',
    card:    '#1a1a22',
    hover:   '#22222e',
    border:  '#2a2a38',
    purple:  '#7c3aed',
    purpleL: '#a78bfa',
    purpleD: '#4c1d95',
    text:    '#e8e8f0',
    muted:   '#8888a0',
    dim:     '#555568',
    ok:      '#22c55e',
    err:     '#ef4444',
    white:   '#ffffff',
  };

  GM_addStyle(`
    #${ROOT_ID} * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif; }
    #yosh-fab {
      position: fixed; bottom: 76px; right: 24px; z-index: 999997;
      width: 40px; height: 40px; border-radius: 50%;
      background: ${C.purpleD}; border: 2px solid ${C.purple};
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 12px rgba(124,58,237,0.4);
      transition: all 0.2s ease; outline: none;
      color: ${C.white}; font-size: 14px; font-weight: 800;
    }
    #yosh-fab:hover { background: ${C.purple}; transform: scale(1.08); }
    #yosh-panel {
      position: fixed; bottom: 126px; right: 24px; z-index: 999996;
      width: 300px; max-height: 72vh; overflow-y: auto;
      background: ${C.panel}; border: 1px solid ${C.border};
      border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.12);
      display: none; flex-direction: column;
    }
    #yosh-panel.open { display: flex; }
    #yosh-header {
      padding: 12px 14px 10px; border-bottom: 1px solid ${C.border};
      background: ${C.bg}; border-radius: 12px 12px 0 0;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 1;
    }
    #yosh-header-left { display: flex; align-items: center; gap: 6px; }
    #yosh-logo {
      width: 22px; height: 22px; border-radius: 5px;
      background: ${C.purple}; color: ${C.white};
      font-size: 11px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    #yosh-title { font-size: 13px; font-weight: 700; color: ${C.text}; }
    #yosh-platform {
      font-size: 10px; color: ${C.purpleL};
      background: ${C.purpleD}; padding: 2px 7px; border-radius: 20px;
    }
    #yosh-close {
      background: none; border: none; color: ${C.dim};
      cursor: pointer; font-size: 18px; line-height: 1; padding: 0 2px;
    }
    #yosh-close:hover { color: ${C.text}; }
    #yosh-search {
      margin: 10px 12px 6px; padding: 7px 10px;
      border: 1px solid ${C.border}; border-radius: 7px;
      background: ${C.card}; color: ${C.text}; font-size: 12px; outline: none;
    }
    #yosh-search:focus { border-color: ${C.purple}; }
    #yosh-body { padding: 4px 10px 12px; display: flex; flex-direction: column; gap: 6px; }
    .yosh-cat { border: 1px solid ${C.border}; border-radius: 8px; overflow: hidden; }
    .yosh-cat-hdr {
      background: ${C.card}; padding: 8px 12px;
      cursor: pointer; display: flex; align-items: center; justify-content: space-between;
      font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.6px;
      text-transform: uppercase;
    }
    .yosh-cat-hdr:hover { background: ${C.hover}; }
    .yosh-cat-body { display: none; flex-direction: column; }
    .yosh-cat-body.open { display: flex; }
    .yosh-action {
      padding: 8px 12px; cursor: pointer;
      border-top: 1px solid ${C.border};
      transition: background 0.12s;
    }
    .yosh-action:hover { background: ${C.hover}; }
    .yosh-action-name { font-size: 12px; font-weight: 600; color: ${C.text}; }
    .yosh-action-desc { font-size: 10px; color: ${C.muted}; margin-top: 1px; }
    #yosh-status {
      margin: 4px 10px 2px; padding: 7px 10px; border-radius: 7px;
      font-size: 11px; font-weight: 500; display: none;
    }
    #yosh-status.show { display: block; }
    #yosh-status.loading { background: rgba(124,58,237,0.1); color: ${C.purpleL}; border: 1px solid ${C.purpleD}; }
    #yosh-status.ok  { background: rgba(34,197,94,0.1); color: ${C.ok}; border: 1px solid rgba(34,197,94,0.3); }
    #yosh-status.err { background: rgba(239,68,68,0.1); color: ${C.err}; border: 1px solid rgba(239,68,68,0.3); }
  `);

  // ─── PLATFORM ────────────────────────────────────────────────────────────────
  function getPlatform() {
    const h = location.hostname;
    if (h.includes('chatgpt.com') || h.includes('chat.openai.com'))
      return { name: 'ChatGPT', sel: '[data-message-author-role]' };
    if (h.includes('claude.ai'))
      return { name: 'Claude', sel: '.human-turn, .ai-turn, [data-testid="human-turn"], [data-testid="ai-turn"]' };
    if (h.includes('gemini.google'))
      return { name: 'Gemini', sel: '.user-query, .model-response, .query-text, .response-container' };
    if (h.includes('perplexity.ai'))
      return { name: 'Perplexity', sel: '.prose, [class*="answer"]' };
    if (h.includes('manus.im'))
      return { name: 'Manus', sel: '[class*="message"], [class*="chat"]' };
    return { name: 'Unknown', sel: 'p' };
  }

  function extractContent(sel) {
    const els = document.querySelectorAll(sel);
    if (!els.length) return document.body.innerText.substring(0, 20000);
    return Array.from(els)
      .map(e => e.innerText?.trim())
      .filter(t => t && t.length > 5)
      .join('\n\n---\n\n')
      .substring(0, 40000);
  }

  // ─── API — Bearer auth, GM_xmlhttpRequest (bypasses CORS) ───────────────────
  function callAPI(action, payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method:  'POST',
        url:     `${API_ENDPOINT}/archive`,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        data:     JSON.stringify(payload),
        timeout:  45000,
        onload:   (r) => {
          try {
            const d = JSON.parse(r.responseText);
            if (r.status >= 200 && r.status < 300) resolve(d);
            else reject(new Error(d.detail || `HTTP ${r.status}`));
          } catch (e) { reject(new Error('Invalid response')); }
        },
        onerror:   () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout')),
      });
    });
  }

  // ─── STATUS ──────────────────────────────────────────────────────────────────
  function setStatus(type, msg) {
    const el = document.getElementById('yosh-status');
    if (!el) return;
    el.className = `show ${type}`;
    el.textContent = msg;
    if (type !== 'loading') setTimeout(() => { el.className = ''; el.textContent = ''; }, 4000);
  }

  // ─── CATEGORIES ──────────────────────────────────────────────────────────────
  const CATEGORIES = [
    { name: 'MÉMOIRE', icon: '🧠', actions: [
      { name: 'Push to YOS',    desc: 'Extraire insights → mémoire active', api: 'push' },
      { name: 'Archive',        desc: 'Verbatim + résumé → YOS Archives',   api: 'archive' },
      { name: 'Push + Archive', desc: 'Insights + verbatim liés',           api: 'push+archive' },
    ]},
    { name: 'CONTENU', icon: '✍️', actions: [
      { name: 'Résumer',        desc: 'Résumé de la conversation',  cmd: 'y.content.summarize' },
      { name: 'Extraire',       desc: 'Extraire données clés',      cmd: 'y.content.extract' },
    ]},
    { name: 'RECHERCHE', icon: '🔍', actions: [
      { name: 'Web',            desc: 'Lancer une recherche web',   cmd: 'y.search.web' },
      { name: 'Analyser page',  desc: 'Analyser la page courante',  cmd: 'y.search.analyze_page' },
    ]},
    { name: 'GESTION', icon: '📋', actions: [
      { name: 'Créer tâche',    desc: 'Créer une tâche Manus',      cmd: 'y.manage.create_task' },
      { name: 'Projet',         desc: 'Gérer un projet',            cmd: 'y.manage.project' },
    ]},
    { name: 'SYSTÈME', icon: '⚙️', actions: [
      { name: 'Aide',           desc: 'Afficher l\'aide YOS',       cmd: 'y.sys.help' },
      { name: 'Statut',         desc: 'Statut du système YOS',      cmd: 'y.sys.status' },
    ]},
  ];

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  function renderCategories(filter) {
    const body = document.getElementById('yosh-body');
    if (!body) return;
    body.innerHTML = '';
    const q = (filter || '').toLowerCase();

    CATEGORIES.forEach(cat => {
      const actions = cat.actions.filter(a =>
        !q || a.name.toLowerCase().includes(q) || (a.desc || '').toLowerCase().includes(q)
      );
      if (!actions.length) return;

      const catEl = document.createElement('div');
      catEl.className = 'yosh-cat';

      const hdr = document.createElement('div');
      hdr.className = 'yosh-cat-hdr';
      hdr.innerHTML = `<span>${cat.icon} ${cat.name}</span><span class="yosh-arrow">▾</span>`;

      const bdy = document.createElement('div');
      bdy.className = 'yosh-cat-body' + (q ? ' open' : '');

      hdr.addEventListener('click', () => {
        bdy.classList.toggle('open');
        hdr.querySelector('.yosh-arrow').textContent = bdy.classList.contains('open') ? '▴' : '▾';
      });

      actions.forEach(action => {
        const btn = document.createElement('div');
        btn.className = 'yosh-action';
        btn.innerHTML = `<div class="yosh-action-name">${action.name}</div><div class="yosh-action-desc">${action.desc || ''}</div>`;
        btn.addEventListener('click', () => handleAction(action));
        bdy.appendChild(btn);
      });

      catEl.appendChild(hdr);
      catEl.appendChild(bdy);
      body.appendChild(catEl);
    });
  }

  async function handleAction(action) {
    if (action.api) {
      const platform = getPlatform();
      const content  = extractContent(platform.sel);
      const title    = document.title.replace(/ - (ChatGPT|Claude|Gemini|Perplexity|Manus).*/, '').trim();
      setStatus('loading', '⏳ Envoi en cours…');
      try {
        const result = await callAPI(action.api, {
          title:           title || 'Untitled',
          source:          platform.name,
          action:          action.api,
          url:             location.href,
          content_full:    content,
          content_summary: content.substring(0, 2000),
        });
        setStatus('ok', `✓ ${action.name} — ${result.message || 'OK'}`);
      } catch (err) {
        setStatus('err', `✗ ${err.message}`);
      }
    } else if (action.cmd) {
      GM_setClipboard(action.cmd);
      setStatus('ok', `✓ Copié : ${action.cmd}`);
    }
  }

  // ─── BUILD UI ────────────────────────────────────────────────────────────────
  function buildUI() {
    const platform = getPlatform();
    const root = document.createElement('div');
    root.id = ROOT_ID;

    root.innerHTML = `
      <button id="yosh-fab" title="YOS Hub">H</button>
      <div id="yosh-panel">
        <div id="yosh-header">
          <div id="yosh-header-left">
            <div id="yosh-logo">Y</div>
            <span id="yosh-title">YOS Hub</span>
            <span id="yosh-platform">${platform.name}</span>
          </div>
          <button id="yosh-close">×</button>
        </div>
        <input id="yosh-search" type="text" placeholder="Rechercher une action…">
        <div id="yosh-status"></div>
        <div id="yosh-body"></div>
      </div>
    `;

    document.body.appendChild(root);

    const fab   = document.getElementById('yosh-fab');
    const panel = document.getElementById('yosh-panel');

    fab.addEventListener('click', () => panel.classList.toggle('open'));
    document.getElementById('yosh-close').addEventListener('click', () => panel.classList.remove('open'));
    document.getElementById('yosh-search').addEventListener('input', (e) => renderCategories(e.target.value));
    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) panel.classList.remove('open');
    });

    renderCategories();
  }

  // ─── INIT — SPA-aware ────────────────────────────────────────────────────────
  function init() {
    if (document.getElementById(ROOT_ID)) return;
    if (!document.body) { setTimeout(init, 150); return; }
    buildUI();
  }

  // Patch history for SPA navigation
  (['pushState', 'replaceState']).forEach(method => {
    const orig = history[method].bind(history);
    history[method] = function () { orig.apply(history, arguments); setTimeout(init, 600); };
  });
  window.addEventListener('popstate', () => setTimeout(init, 600));

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 1500);
  setTimeout(init, 4500);

})();
