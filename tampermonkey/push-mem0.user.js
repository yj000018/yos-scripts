// ==UserScript==
// @name         Y-OS Push to Mem0
// @namespace    https://yos.ai
// @version      3.0.0
// @description  Push any LLM conversation to Mem0 memory system with 1 click
// @author       Yannick — Y-OS
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://grok.com/*
// @match        https://gemini.google.com/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @match        https://manus.im/*
// @match        https://*.manus.computer/*
// @match        https://copilot.microsoft.com/*
// @match        https://mistral.ai/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      yos-push-webhook.fly.dev
// @connect      api.mem0.ai
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  const CONFIG = {
    webhook: "https://yos-push-webhook.fly.dev/push",
    mem0Token: "m0-2M5Fyr4gVUtE0i4tHKfdkYbdDrqBArBiv5c11fUp",
    userId: "yannick-yos",
    buttonId: "yos-mem0-btn",
    toastId: "yos-mem0-toast"
  };

  // ── LLM Detection ───────────────────────────────────────────────────────────
  function detectSource() {
    const h = location.hostname;
    if (h.includes("chatgpt") || h.includes("openai")) return "chatgpt";
    if (h.includes("claude")) return "claude";
    if (h.includes("grok") || h.includes("x.ai")) return "grok";
    if (h.includes("gemini")) return "gemini";
    if (h.includes("perplexity")) return "perplexity";
    if (h.includes("manus")) return "manus";
    if (h.includes("copilot")) return "copilot";
    if (h.includes("mistral")) return "mistral";
    return "unknown";
  }

  // ── DOM Extractors ───────────────────────────────────────────────────────────
  const EXTRACTORS = {
    chatgpt: () => {
      const turns = document.querySelectorAll('[data-message-author-role]');
      if (!turns.length) return null;
      return Array.from(turns).map(el => {
        const role = el.getAttribute('data-message-author-role');
        const content = el.querySelector('.markdown, .whitespace-pre-wrap, [class*="prose"]')?.innerText
                     || el.innerText;
        return `${role === 'user' ? 'User' : 'Assistant'}: ${content.trim()}`;
      }).filter(t => t.length > 10).join('\n\n');
    },
    claude: () => {
      // Try multiple Claude selectors (UI changes frequently)
      let turns = document.querySelectorAll('[data-testid="human-turn"], [data-testid="ai-turn"]');
      if (!turns.length) turns = document.querySelectorAll('.human-turn, .ai-turn');
      if (!turns.length) turns = document.querySelectorAll('[class*="HumanTurn"], [class*="AITurn"]');
      if (!turns.length) {
        // Last resort: get all message containers
        const containers = document.querySelectorAll('[class*="message"][class*="container"], [class*="Message"]');
        if (containers.length) turns = containers;
      }
      if (!turns.length) return document.body.innerText.substring(0, 20000);
      return Array.from(turns).map(el => {
        const testId = el.getAttribute('data-testid') || '';
        const cls = el.className || '';
        const isHuman = testId.includes('human') || cls.toLowerCase().includes('human');
        return `${isHuman ? 'User' : 'Assistant'}: ${el.innerText.trim()}`;
      }).filter(t => t.length > 10).join('\n\n');
    },
    grok: () => {
      const msgs = document.querySelectorAll('[class*="message-bubble"], [class*="MessageBubble"], [class*="response"]');
      if (!msgs.length) return document.body.innerText.substring(0, 20000);
      return Array.from(msgs).map(el => el.innerText.trim()).filter(t => t.length > 10).join('\n\n');
    },
    gemini: () => {
      const turns = document.querySelectorAll('user-query, model-response');
      if (!turns.length) {
        const els = document.querySelectorAll('[class*="query"], [class*="response"]');
        if (!els.length) return document.body.innerText.substring(0, 20000);
        return Array.from(els).map(el => el.innerText.trim()).filter(t => t.length > 10).join('\n\n');
      }
      return Array.from(turns).map(el => {
        const isUser = el.tagName.toLowerCase() === 'user-query';
        return `${isUser ? 'User' : 'Assistant'}: ${el.innerText.trim()}`;
      }).filter(t => t.length > 10).join('\n\n');
    },
    perplexity: () => {
      const answers = document.querySelectorAll('[class*="prose"], .col-span-8 [class*="answer"]');
      const questions = document.querySelectorAll('[class*="query"], [class*="question"]');
      if (!answers.length && !questions.length) return document.body.innerText.substring(0, 20000);
      const all = [...Array.from(questions).map(el => `User: ${el.innerText.trim()}`),
                   ...Array.from(answers).map(el => `Assistant: ${el.innerText.trim()}`)];
      return all.filter(t => t.length > 10).join('\n\n');
    },
    manus: () => {
      const msgs = document.querySelectorAll('[class*="message"], [class*="chat-item"]');
      if (!msgs.length) return document.body.innerText.substring(0, 20000);
      return Array.from(msgs).map(el => el.innerText.trim()).filter(t => t.length > 10).join('\n\n');
    },
    unknown: () => document.body.innerText.substring(0, 20000)
  };

  // ── Extract conversation ─────────────────────────────────────────────────────
  function extractConversation() {
    const source = detectSource();
    const extractor = EXTRACTORS[source] || EXTRACTORS.unknown;
    const text = extractor();
    if (!text || text.trim().length < 20) {
      return { text: document.body.innerText.substring(0, 20000), source };
    }
    return { text: text.trim(), source };
  }

  // ── Push via GM_xmlhttpRequest (bypasses CORS) ───────────────────────────────
  function pushToWebhook(text, source, onSuccess, onError) {
    GM_xmlhttpRequest({
      method: "POST",
      url: CONFIG.webhook,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({
        text,
        url: location.href,
        source,
        user_id: CONFIG.userId
      }),
      onload: (res) => {
        try {
          const data = JSON.parse(res.responseText);
          if (data.ok) onSuccess(data);
          else onError(data.error || "Push failed");
        } catch (e) {
          onError("Parse error");
        }
      },
      onerror: () => {
        // Fallback: push directly to Mem0
        pushDirectToMem0(text, source, onSuccess, onError);
      }
    });
  }

  function pushDirectToMem0(text, source, onSuccess, onError) {
    GM_xmlhttpRequest({
      method: "POST",
      url: "https://api.mem0.ai/v1/memories/",
      headers: {
        "Authorization": `Token ${CONFIG.mem0Token}`,
        "Content-Type": "application/json"
      },
      data: JSON.stringify({
        messages: [{ role: "user", content: text }],
        user_id: CONFIG.userId,
        metadata: { source, url: location.href }
      }),
      onload: (res) => {
        try {
          const data = JSON.parse(res.responseText);
          onSuccess({ ok: true, memories_created: Array.isArray(data) ? data.length : 1, source, fallback: true });
        } catch (e) {
          onError("Mem0 direct push failed");
        }
      },
      onerror: () => onError("Network error")
    });
  }

  // ── Toast Notification ───────────────────────────────────────────────────────
  function showToast(message, type = "success") {
    let toast = document.getElementById(CONFIG.toastId);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = CONFIG.toastId;
      toast.style.cssText = `
        position: fixed; bottom: 80px; right: 20px; z-index: 999999;
        padding: 12px 18px; border-radius: 8px; font-family: 'DM Mono', monospace;
        font-size: 13px; font-weight: 500; max-width: 320px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3); transition: opacity 0.3s;
        backdrop-filter: blur(10px);
      `;
      document.body.appendChild(toast);
    }
    const colors = {
      success: { bg: "rgba(16,185,129,0.15)", border: "#10b981", color: "#10b981" },
      error:   { bg: "rgba(239,68,68,0.15)",  border: "#ef4444", color: "#ef4444" },
      loading: { bg: "rgba(59,130,246,0.15)", border: "#3b82f6", color: "#3b82f6" }
    };
    const c = colors[type] || colors.success;
    toast.style.background = c.bg;
    toast.style.border = `1px solid ${c.border}`;
    toast.style.color = c.color;
    toast.style.opacity = "1";
    toast.innerHTML = `<span style="margin-right:8px">${type === 'loading' ? '⟳' : type === 'success' ? '✓' : '✗'}</span>${message}`;
    if (type !== 'loading') {
      setTimeout(() => { toast.style.opacity = "0"; }, 3000);
    }
  }

  // ── Floating Button ──────────────────────────────────────────────────────────
  function createButton() {
    if (document.getElementById(CONFIG.buttonId)) return;

    const btn = document.createElement('button');
    btn.id = CONFIG.buttonId;
    btn.title = "Push to Mem0 (Y-OS)";
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span style="margin-left:6px;font-size:12px;font-weight:600;letter-spacing:0.05em">MEM0</span>
    `;
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999998;
      display: flex; align-items: center; padding: 10px 16px;
      background: rgba(15,20,30,0.9); color: #3b82f6;
      border: 1px solid rgba(59,130,246,0.4); border-radius: 8px;
      cursor: pointer; font-family: 'DM Mono', monospace;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); backdrop-filter: blur(10px);
      transition: all 0.2s ease;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = "rgba(59,130,246,0.2)";
      btn.style.borderColor = "rgba(59,130,246,0.8)";
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = "rgba(15,20,30,0.9)";
      btn.style.borderColor = "rgba(59,130,246,0.4)";
    });
    btn.addEventListener('click', handlePush);
    document.body.appendChild(btn);
  }

  // ── Handle Push ──────────────────────────────────────────────────────────────
  function handlePush() {
    const { text, source } = extractConversation();
    if (!text || text.length < 20) {
      showToast("No conversation found on this page", "error");
      return;
    }
    showToast(`Extracting from ${source}...`, "loading");
    pushToWebhook(text, source,
      (data) => {
        const n = data.memories_created || "?";
        const fallback = data.fallback ? " (direct)" : "";
        showToast(`✓ ${n} memories indexed from ${source}${fallback}`, "success");
        GM_notification({
          title: "Y-OS Mem0",
          text: `${n} memories indexed from ${source}`,
          timeout: 4000
        });
      },
      (err) => showToast(`Error: ${err}`, "error")
    );
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createButton);
    } else {
      createButton();
    }
    // Re-create button on SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(createButton, 1000);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
