// Y-OS Push to Mem0 v6.1 — Parseur étendu (paragraphes + séparateurs)
// GitHub: yj000018/yos-scripts — scriptable/push-mem0.scriptable.js
// NE PAS INSTALLER DIRECTEMENT — utiliser push-mem0-loader.scriptable.js

const VERSION = "6.1";
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
    await notify("Y-OS Mem0", "Aucun texte reçu. Partager du texte ou une URL.");
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
  const content = rawText || rawURL;
  const messages = parseConversation(content, source);
  const msgCount = messages.length;
  const isMultiTurn = msgCount > 1;

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
    metadata: { source, url: rawURL, turns: msgCount, version: VERSION, multi_turn: isMultiTurn }
  });
  req.timeoutInterval = 20;

  try {
    const res = await req.loadJSON();
    const isPending = Array.isArray(res) && res[0]?.status === "PENDING";
    const memCount = Array.isArray(res) ? res.length : 1;
    const label = isMultiTurn ? msgCount + " tours" : "1 bloc";
    await notify(
      "✓ Y-OS Mem0 — " + source.toUpperCase() + " v" + VERSION,
      isPending
        ? label + " → indexation ~30s"
        : memCount + " mémoire(s) · " + label
    );
  } catch (e) {
    await notify("✗ Y-OS Mem0 erreur", String(e.message || e).substring(0, 100));
  }
}

// ── Parseur de conversation multi-format ────────────────────────────────────
// Stratégie : labels explicites → séparateurs visuels → paragraphes → fallback
function parseConversation(text, source) {
  if (!text || text.length < 10) return [{ role: "user", content: text || "" }];

  // 1. Labels explicites ligne par ligne
  const hasLabels = /^(Human|You|User|Vous|Moi|Me|Assistant|ChatGPT|Claude|Gemini|Grok|Perplexity|Manus):/m.test(text);
  if (hasLabels) {
    const lines = text.split(/\n/);
    const messages = [];
    let currentRole = null;
    let currentLines = [];
    for (const line of lines) {
      if (/^(Human|You|User|Vous|Moi|Me):\s*/.test(line)) {
        if (currentRole) messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
        currentRole = "user";
        currentLines = [line.replace(/^(Human|You|User|Vous|Moi|Me):\s*/, "")];
      } else if (/^(Assistant|ChatGPT|Claude|Gemini|Grok|Perplexity|Manus):\s*/.test(line)) {
        if (currentRole) messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
        currentRole = "assistant";
        currentLines = [line.replace(/^(Assistant|ChatGPT|Claude|Gemini|Grok|Perplexity|Manus):\s*/, "")];
      } else {
        currentLines.push(line);
      }
    }
    if (currentRole && currentLines.length) messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
    const result = messages.filter(m => m.content.length > 0);
    if (result.length > 1) return result;
  }

  // 2. Séparateurs visuels (3+ lignes vides, ----, ====)
  const blocks = text.split(/\n{3,}|^[-=]{4,}\s*$/m).map(b => b.trim()).filter(b => b.length > 20);
  if (blocks.length >= 2) {
    return blocks.map((block, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: block }));
  }

  // 3. Paragraphes (texte long > 300 chars avec au moins 2 paragraphes)
  if (text.length > 300) {
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 30);
    if (paragraphs.length >= 2) {
      return paragraphs.map((para, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: para }));
    }
  }

  // 4. Fallback : texte brut en un seul message user
  return [{ role: "user", content: text.trim() }];
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
