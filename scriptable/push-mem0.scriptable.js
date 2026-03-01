// Y-OS Push to Mem0 v6.0 — Auto-updatable via loader
// GitHub: yj000018/yos-scripts — scriptable/push-mem0.scriptable.js
// NE PAS INSTALLER DIRECTEMENT — utiliser push-mem0-loader.scriptable.js

const VERSION = "6.0";
const MEM0_TOKEN = "m0-2M5Fyr4gVUtE0i4tHKfdkYbdDrqBArBiv5c11fUp";
const USER_ID = "yannick";

// ── Point d'entrée appelé par le loader ──────────────────────────────────────
async function run(injectedArgs) {
  const _args = injectedArgs || args;

  // ── Input ───────────────────────────────────────────────────────────────────
  let rawText = _args.plainTexts?.[0] || "";
  let rawURL  = _args.urls?.[0]?.absoluteString || "";
  if (!rawText && !rawURL) rawText = Pasteboard.paste() || "";
  if (!rawText && !rawURL) {
    await notify("Y-OS Mem0", "Aucun texte reçu.");
    return;
  }

  // ── Source detection ────────────────────────────────────────────────────────
  const combined = (rawURL + " " + rawText).toLowerCase();
  const source = combined.includes("chatgpt") || combined.includes("openai") ? "chatgpt"
    : combined.includes("claude")      ? "claude"
    : combined.includes("grok")        ? "grok"
    : combined.includes("gemini")      ? "gemini"
    : combined.includes("perplexity")  ? "perplexity"
    : combined.includes("manus")       ? "manus"
    : "unknown";

  // ── Conversation parser ─────────────────────────────────────────────────────
  const messages = parseConversation(rawText || rawURL);
  const msgCount = messages.length;

  // ── Push to Mem0 ────────────────────────────────────────────────────────────
  const req = new Request("https://api.mem0.ai/v1/memories/");
  req.method = "POST";
  req.headers = {
    "Authorization": "Token " + MEM0_TOKEN,
    "Content-Type": "application/json"
  };
  req.body = JSON.stringify({
    messages,
    user_id: USER_ID,
    metadata: { source, url: rawURL, turns: msgCount, version: VERSION }
  });
  req.timeoutInterval = 20;

  try {
    const res = await req.loadJSON();
    const isPending = Array.isArray(res) && res[0]?.status === "PENDING";
    const label = msgCount > 1 ? msgCount + " tours" : "1 message";
    await notify(
      "✓ Y-OS Mem0 — " + source.toUpperCase(),
      isPending
        ? label + " → indexation en cours (~30s)"
        : (Array.isArray(res) ? res.length : 1) + " mémoire(s) créée(s)"
    );
  } catch (e) {
    await notify("✗ Y-OS Mem0 erreur", String(e.message || e).substring(0, 100));
  }
}

// ── Parseur de conversation multi-format ────────────────────────────────────
function parseConversation(text) {
  if (!text || text.length < 20) return [{ role: "user", content: text }];

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
    if (!matched) currentLines.push(line);
  }

  if (currentRole && currentLines.length) {
    messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
  }

  return messages.length > 0 ? messages : [{ role: "user", content: text }];
}

// ── Utilitaire notification ──────────────────────────────────────────────────
async function notify(title, body) {
  let n = new Notification();
  n.title = title;
  n.body  = body;
  await n.schedule();
}

// ── Export pour importModule() ───────────────────────────────────────────────
module.exports = { run, VERSION };
