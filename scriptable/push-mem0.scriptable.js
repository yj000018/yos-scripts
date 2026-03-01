// Y-OS Push to Mem0 v6.3 — Webhook Fly.io + fallback direct Mem0
// GitHub: yj000018/yos-scripts — scriptable/push-mem0.scriptable.js
// NE PAS INSTALLER DIRECTEMENT — utiliser push-mem0-loader.scriptable.js
// Nouveautés v6.3 :
//   - Route principale : webhook Fly.io (https://yos-push-webhook.fly.dev/push)
//   - Fallback automatique vers Mem0 direct si webhook indisponible
//   - Notification indique la route utilisée (webhook vs direct)
//   - Token Mem0 lu depuis le script (fallback) ou via webhook (principal)

const VERSION = "6.3";
const MEM0_TOKEN = "m0-2M5Fyr4gVUtE0i4tHKfdkYbdDrqBArBiv5c11fUp";
const USER_ID = "yannick";
const WEBHOOK_URL = "https://yos-push-webhook.fly.dev/push";

// ── Point d'entrée appelé par le loader ──────────────────────────────────────
async function run(injectedArgs) {
  const _args = injectedArgs || args;

  // ── Input ───────────────────────────────────────────────────────────────────
  let rawText = _args.plainTexts?.[0] || "";
  let rawURL  = _args.urls?.[0]?.absoluteString || "";

  // Fallback clipboard si Share Sheet vide
  if (!rawText && !rawURL) {
    try { rawText = Pasteboard.paste() || ""; } catch(e) {}
  }

  if (!rawText && !rawURL) {
    await notify("Y-OS Mem0 v" + VERSION, "❌ Aucun texte reçu. Partager du texte depuis une app.");
    return;
  }

  // ── Source detection ────────────────────────────────────────────────────────
  const combined = (rawURL + " " + rawText).toLowerCase();
  const source =
    combined.includes("chatgpt") || combined.includes("openai") ? "chatgpt"
    : combined.includes("claude")      ? "claude"
    : combined.includes("grok")        ? "grok"
    : combined.includes("gemini")      ? "gemini"
    : combined.includes("perplexity")  ? "perplexity"
    : combined.includes("manus")       ? "manus"
    : "unknown";

  // ── Conversation parser ─────────────────────────────────────────────────────
  const content = rawText || rawURL;
  let messages;
  try {
    messages = parseConversation(content, source);
  } catch(e) {
    await notify("Y-OS Mem0 v" + VERSION + " — Erreur parseur", String(e).substring(0, 100));
    return;
  }

  const msgCount = messages.length;
  const isMultiTurn = msgCount > 1;

  // ── Notification de progression ─────────────────────────────────────────────
  await notify(
    "⏳ Y-OS Mem0 v" + VERSION + " — " + source.toUpperCase(),
    msgCount + " tour(s) détecté(s) · envoi…"
  );

  // ── Route 1 : Webhook Fly.io (enrichissement avant Mem0) ────────────────────
  const webhookResult = await pushViaWebhook(rawText || rawURL, source, rawURL, msgCount);

  if (webhookResult.ok) {
    const memCount = webhookResult.memories_created || 0;
    const label = isMultiTurn ? msgCount + " tours" : "1 bloc";
    await notify(
      "✅ Y-OS Mem0 v" + VERSION + " — " + source.toUpperCase(),
      "🔗 webhook · " + memCount + " mémoire(s) · " + label
    );
    return;
  }

  // ── Route 2 : Fallback direct Mem0 si webhook indisponible ──────────────────
  await pushDirectMem0(messages, source, rawURL, msgCount, isMultiTurn);
}

// ── Push via webhook Fly.io ───────────────────────────────────────────────────
async function pushViaWebhook(text, source, url, turns) {
  try {
    const req = new Request(WEBHOOK_URL);
    req.method = "POST";
    req.headers = { "Content-Type": "application/json" };
    req.body = JSON.stringify({
      text,
      source,
      url: url || "",
      user_id: USER_ID,
      metadata: { version: VERSION, turns, source }
    });
    req.timeoutInterval = 20;
    const res = await req.loadJSON();
    return res && res.ok ? res : { ok: false };
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

// ── Push direct Mem0 (fallback) ───────────────────────────────────────────────
async function pushDirectMem0(messages, source, rawURL, msgCount, isMultiTurn) {
  const req = new Request("https://api.mem0.ai/v1/memories/");
  req.method = "POST";
  req.headers = {
    "Authorization": "Token " + MEM0_TOKEN,
    "Content-Type": "application/json"
  };
  req.body = JSON.stringify({
    messages,
    user_id: USER_ID,
    metadata: {
      source,
      url: rawURL,
      turns: msgCount,
      version: VERSION,
      multi_turn: isMultiTurn,
      route: "direct"
    }
  });
  req.timeoutInterval = 25;

  try {
    const res = await req.loadJSON();
    const isPending = Array.isArray(res) && res[0]?.status === "PENDING";
    const memCount  = Array.isArray(res) ? res.length : 1;
    const label     = isMultiTurn ? msgCount + " tours" : "1 bloc";

    await notify(
      "✅ Y-OS Mem0 v" + VERSION + " — " + source.toUpperCase(),
      isPending
        ? "⚡ direct · " + label + " → " + memCount + " embedding(s) ~30s"
        : "⚡ direct · " + memCount + " mémoire(s) · " + label
    );
  } catch (e) {
    await notify(
      "❌ Y-OS Mem0 v" + VERSION + " — Erreur API",
      String(e.message || e).substring(0, 120)
    );
  }
}

// ── Parseur de conversation multi-format ─────────────────────────────────────
// Ordre de priorité :
//   1. Labels explicites (Human:/You:/ChatGPT:/Claude: etc.)
//   2. Séparateurs ChatGPT iOS : tirets longs Unicode ─── ou ═══ ou em-dashes
//   3. Pattern ChatGPT iOS sans séparateurs : alternance court/long
//   4. Séparateurs visuels génériques (----, ====, 3+ lignes vides)
//   5. Paragraphes (texte > 300 chars)
//   6. Fallback : bloc unique user
function parseConversation(text, source) {
  if (!text || text.length < 10) return [{ role: "user", content: text || "" }];

  // 1. Labels explicites ligne par ligne
  const labelRe = /^(Human|You|User|Vous|Moi|Me|Assistant|ChatGPT|Claude|Gemini|Grok|Perplexity|Manus)\s*[:\|]\s*/m;
  if (labelRe.test(text)) {
    const lines = text.split(/\n/);
    const messages = [];
    let currentRole = null;
    let currentLines = [];
    for (const line of lines) {
      const userMatch = line.match(/^(Human|You|User|Vous|Moi|Me)\s*[:\|]\s*/);
      const asstMatch = line.match(/^(Assistant|ChatGPT|Claude|Gemini|Grok|Perplexity|Manus)\s*[:\|]\s*/);
      if (userMatch) {
        if (currentRole) messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
        currentRole = "user";
        currentLines = [line.replace(userMatch[0], "")];
      } else if (asstMatch) {
        if (currentRole) messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
        currentRole = "assistant";
        currentLines = [line.replace(asstMatch[0], "")];
      } else {
        currentLines.push(line);
      }
    }
    if (currentRole && currentLines.length) messages.push({ role: currentRole, content: currentLines.join("\n").trim() });
    const result = messages.filter(m => m.content.trim().length > 0);
    if (result.length > 1) return result;
  }

  // 2. Séparateurs ChatGPT iOS : tirets longs Unicode, em-dashes, lignes de tirets
  const chatgptSepRe = /\n[─═—\-]{3,}\n|\n{3,}/g;
  const chatgptBlocks = text.split(chatgptSepRe).map(b => b.trim()).filter(b => b.length > 15);
  if (chatgptBlocks.length >= 2) {
    return chatgptBlocks.map((block, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: block
    }));
  }

  // 3. Pattern ChatGPT iOS sans séparateurs : alternance paragraphes courts/longs
  if (source === "chatgpt" && text.length > 400) {
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 10);
    if (paragraphs.length >= 2) {
      const messages = [];
      let currentRole = null;
      let currentContent = [];
      for (const para of paragraphs) {
        const role = para.length < 250 ? "user" : "assistant";
        if (role !== currentRole) {
          if (currentRole) messages.push({ role: currentRole, content: currentContent.join("\n\n").trim() });
          currentRole = role;
          currentContent = [para];
        } else {
          currentContent.push(para);
        }
      }
      if (currentRole && currentContent.length) messages.push({ role: currentRole, content: currentContent.join("\n\n").trim() });
      const result = messages.filter(m => m.content.length > 0);
      if (result.length > 1) return result;
    }
  }

  // 4. Séparateurs visuels génériques
  const blocks = text.split(/\n{3,}|^[-=]{4,}\s*$/m).map(b => b.trim()).filter(b => b.length > 20);
  if (blocks.length >= 2) {
    return blocks.map((block, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: block }));
  }

  // 5. Paragraphes longs
  if (text.length > 300) {
    const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 30);
    if (paragraphs.length >= 2) {
      return paragraphs.map((para, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: para }));
    }
  }

  // 6. Fallback : texte brut en un seul message user
  return [{ role: "user", content: text.trim() }];
}

// ── Utilitaire notification ───────────────────────────────────────────────────
async function notify(title, body) {
  try {
    let n = new Notification();
    n.title = title;
    n.body  = body || "";
    await n.schedule();
  } catch(e) {
    // Silencieux si notification impossible
  }
}

// ── Export pour importModule() ────────────────────────────────────────────────
module.exports = { run, VERSION };
