/**
 * Y-OS Push to Mem0 — Core Logic
 * Shared between Tampermonkey and Scriptable
 * 
 * Webhook: https://yos-push-webhook.fly.dev/push
 * Direct:  https://api.mem0.ai/v1/memories/
 */

const YOS_CONFIG = {
  webhook: "https://yos-push-webhook.fly.dev/push",
  mem0Direct: "https://api.mem0.ai/v1/memories/",
  mem0Token: "m0-2M5Fyr4gVUtE0i4tHKfdkYbdDrqBArBiv5c11fUp",
  userId: "yannick-yos",
  version: "3.0.0"
};

// ── LLM Source Detection ──────────────────────────────────────────────────────
function detectLLMSource(urlOrText) {
  const s = (urlOrText || "").toLowerCase();
  if (s.includes("chatgpt.com") || s.includes("chat.openai.com")) return "chatgpt";
  if (s.includes("claude.ai")) return "claude";
  if (s.includes("grok.com") || s.includes("x.ai")) return "grok";
  if (s.includes("gemini.google.com") || s.includes("bard.google")) return "gemini";
  if (s.includes("perplexity.ai")) return "perplexity";
  if (s.includes("manus.im") || s.includes("manus.computer")) return "manus";
  if (s.includes("copilot.microsoft.com")) return "copilot";
  if (s.includes("mistral.ai")) return "mistral";
  return "unknown";
}

// ── DOM Extractors (Tampermonkey only) ────────────────────────────────────────
const DOM_EXTRACTORS = {
  chatgpt: () => {
    const turns = document.querySelectorAll('[data-message-author-role]');
    if (!turns.length) return null;
    return Array.from(turns).map(el => {
      const role = el.getAttribute('data-message-author-role');
      const text = el.querySelector('.markdown, .whitespace-pre-wrap, [class*="prose"]')?.innerText
                || el.innerText;
      return `${role === 'user' ? 'User' : 'Assistant'}: ${text.trim()}`;
    }).filter(Boolean).join('\n\n');
  },
  claude: () => {
    const turns = document.querySelectorAll('[data-testid="human-turn"], [data-testid="ai-turn"]');
    if (!turns.length) {
      // Fallback: try generic structure
      const msgs = document.querySelectorAll('.human-turn, .ai-turn, [class*="HumanTurn"], [class*="AITurn"]');
      if (!msgs.length) return null;
      return Array.from(msgs).map(el => {
        const isHuman = el.className.toLowerCase().includes('human');
        return `${isHuman ? 'User' : 'Assistant'}: ${el.innerText.trim()}`;
      }).join('\n\n');
    }
    return Array.from(turns).map(el => {
      const isHuman = el.getAttribute('data-testid') === 'human-turn';
      return `${isHuman ? 'User' : 'Assistant'}: ${el.innerText.trim()}`;
    }).join('\n\n');
  },
  grok: () => {
    // Grok uses React, try multiple selectors
    const msgs = document.querySelectorAll('[class*="message"], [class*="Message"], [class*="turn"]');
    if (!msgs.length) return document.body.innerText.substring(0, 8000);
    return Array.from(msgs).map(el => el.innerText.trim()).filter(t => t.length > 10).join('\n\n');
  },
  gemini: () => {
    const turns = document.querySelectorAll('user-query, model-response, [class*="user-query"], [class*="model-response"]');
    if (!turns.length) return null;
    return Array.from(turns).map(el => {
      const isUser = el.tagName.toLowerCase().includes('user') || el.className.includes('user');
      return `${isUser ? 'User' : 'Assistant'}: ${el.innerText.trim()}`;
    }).join('\n\n');
  },
  perplexity: () => {
    const msgs = document.querySelectorAll('[class*="prose"], [class*="answer"], .col-span-8');
    if (!msgs.length) return null;
    return Array.from(msgs).map(el => el.innerText.trim()).filter(t => t.length > 20).join('\n\n');
  },
  manus: () => {
    const msgs = document.querySelectorAll('[class*="message"], [class*="chat"]');
    if (!msgs.length) return document.body.innerText.substring(0, 8000);
    return Array.from(msgs).map(el => el.innerText.trim()).filter(t => t.length > 10).join('\n\n');
  }
};

// ── Text Normalizer ───────────────────────────────────────────────────────────
function normalizeConversation(text, source) {
  if (!text) return "";
  // Remove excessive whitespace
  let clean = text.replace(/\n{4,}/g, '\n\n').trim();
  // Truncate if too long (Mem0 limit ~50k chars)
  if (clean.length > 50000) clean = clean.substring(0, 50000) + "\n[truncated]";
  return clean;
}

// ── Push to Webhook ───────────────────────────────────────────────────────────
async function pushToWebhook(text, options = {}) {
  const { url = "", project = "", tags = [] } = options;
  const source = detectLLMSource(url || text);
  
  const payload = {
    text: normalizeConversation(text, source),
    url,
    source,
    project,
    tags,
    user_id: YOS_CONFIG.userId
  };

  try {
    const res = await fetch(YOS_CONFIG.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    // Fallback: push directly to Mem0
    return await pushDirectToMem0(text, source, project);
  }
}

// ── Push Direct to Mem0 (fallback) ────────────────────────────────────────────
async function pushDirectToMem0(text, source, project) {
  const messages = parseToMessages(text, source);
  const res = await fetch(YOS_CONFIG.mem0Direct, {
    method: "POST",
    headers: {
      "Authorization": `Token ${YOS_CONFIG.mem0Token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages,
      user_id: YOS_CONFIG.userId,
      metadata: { source, project }
    })
  });
  const data = await res.json();
  return { ok: true, memories_created: Array.isArray(data) ? data.length : 1, source, fallback: true };
}

// ── Parse text to Mem0 messages format ───────────────────────────────────────
function parseToMessages(text, source) {
  const lines = text.split('\n').filter(l => l.trim());
  const messages = [];
  let current = null;

  const USER_PATTERNS = /^(User|Human|Vous|You|Me|Moi|Q):\s*/i;
  const ASST_PATTERNS = /^(Assistant|Claude|GPT|Grok|Gemini|Perplexity|Manus|AI|A|R):\s*/i;

  for (const line of lines) {
    if (USER_PATTERNS.test(line)) {
      if (current) messages.push(current);
      current = { role: "user", content: line.replace(USER_PATTERNS, '').trim() };
    } else if (ASST_PATTERNS.test(line)) {
      if (current) messages.push(current);
      current = { role: "assistant", content: line.replace(ASST_PATTERNS, '').trim() };
    } else if (current) {
      current.content += '\n' + line;
    } else {
      current = { role: "user", content: line };
    }
  }
  if (current) messages.push(current);
  return messages.length ? messages : [{ role: "user", content: text }];
}

// Export for Node/CommonJS (Scriptable uses this)
if (typeof module !== 'undefined') module.exports = { YOS_CONFIG, detectLLMSource, DOM_EXTRACTORS, pushToWebhook, pushDirectToMem0, normalizeConversation };
