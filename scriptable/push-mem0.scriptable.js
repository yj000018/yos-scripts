// Y-OS Push to Mem0 v5.0 — Conversation parser + Direct Mem0
// GitHub: yj000018/yos-scripts — scriptable/push-mem0.scriptable.js

const MEM0_TOKEN = "m0-2M5Fyr4gVUtE0i4tHKfdkYbdDrqBArBiv5c11fUp";
const USER_ID = "yannick";

// ── Input ─────────────────────────────────────────────────────────────────────
let rawText = args.plainTexts?.[0] || "";
let rawURL  = args.urls?.[0]?.absoluteString || "";
if (!rawText && !rawURL) rawText = Pasteboard.paste() || "";

if (!rawText && !rawURL) {
  let n = new Notification();
  n.title = "Y-OS Mem0";
  n.body  = "Aucun texte reçu.";
  await n.schedule();
  Script.complete();
}

// ── Source detection ──────────────────────────────────────────────────────────
const combined = (rawURL + " " + rawText).toLowerCase();
const source = combined.includes("chatgpt") || combined.includes("openai") ? "chatgpt"
  : combined.includes("claude")      ? "claude"
  : combined.includes("grok")        ? "grok"
  : combined.includes("gemini")      ? "gemini"
  : combined.includes("perplexity")  ? "perplexity"
  : combined.includes("manus")       ? "manus"
  : "unknown";

// ── Conversation parser ───────────────────────────────────────────────────────
function parseConversation(text) {
  if (!text || text.length < 20) return [{ role: "user", content: text }];

  // Patterns label:contenu sur lignes séparées
  const labelPatterns = [
    { u: /^Human:\s*/,   a: /^Assistant:\s*/ },
    { u: /^You:\s*/,     a: /^ChatGPT:\s*/ },
    { u: /^User:\s*/,    a: /^Assistant:\s*/ },
    { u: /^Vous:\s*/,    a: /^Claude:\s*/ },
    { u: /^Moi:\s*/,     a: /^(?:Claude|ChatGPT|Gemini|Grok|Perplexity|Manus):\s*/ },
    { u: /^Human\s*$/,   a: /^(?:Assistant|Claude|ChatGPT|AI)\s*$/ },
  ];

  const lines = text.split(/\n/);
  const messages = [];
  let currentRole = null;
  let currentLines = [];

  for (const line of lines) {
    let matched = false;
    for (const p of labelPatterns) {
      if (p.u.test(line)) {
        if (currentRole) messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
        currentRole = "user";
        currentLines = [line.replace(p.u, "")];
        matched = true; break;
      }
      if (p.a.test(line)) {
        if (currentRole) messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
        currentRole = "assistant";
        currentLines = [line.replace(p.a, "")];
        matched = true; break;
      }
    }
    if (!matched && currentRole) currentLines.push(line);
    else if (!matched && !currentRole) currentLines.push(line);
  }
  if (currentRole && currentLines.length) {
    messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
  }

  // Si aucun pattern détecté, texte brut
  if (messages.length === 0) return [{ role: "user", content: text }];
  return messages;
}

// ── Build messages ────────────────────────────────────────────────────────────
const content = rawText || rawURL;
const messages = parseConversation(content);
const msgCount = messages.length;

// ── Push to Mem0 ──────────────────────────────────────────────────────────────
const req = new Request("https://api.mem0.ai/v1/memories/");
req.method = "POST";
req.headers = {
  "Authorization": "Token " + MEM0_TOKEN,
  "Content-Type": "application/json"
};
req.body = JSON.stringify({
  messages: messages,
  user_id: USER_ID,
  metadata: { source, url: rawURL, turns: msgCount }
});
req.timeoutInterval = 20;

try {
  const res = await req.loadJSON();
  const isPending = Array.isArray(res) && res[0]?.status === "PENDING";
  let n = new Notification();
  n.title = "✓ Y-OS Mem0 — " + source.toUpperCase();
  n.body  = isPending
    ? msgCount + " tours → indexation en cours (30s)"
    : (Array.isArray(res) ? res.length : 1) + " mémoire(s) créée(s)";
  await n.schedule();
} catch(e) {
  let n = new Notification();
  n.title = "✗ Y-OS Mem0 erreur";
  n.body  = String(e.message || e).substring(0, 100);
  await n.schedule();
}

Script.complete();
