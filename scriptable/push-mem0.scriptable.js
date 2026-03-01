// Y-OS Push to Mem0 — Scriptable iOS
// Version: 3.1.0 — No Alert (compatible loader eval)
// Déclencheur: Share Sheet (texte ou URL depuis n'importe quelle app iOS)
// Feedback: Notifications iOS uniquement (pas de Alert)

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  webhook: "https://yos-push-webhook.fly.dev/push",
  mem0Token: "m0-2M5Fyr4gVUtE0i4tHKfdkYbdDrqBArBiv5c11fUp",
  userId: "yannick-yos"
};

// ── Notification helper ───────────────────────────────────────────────────────
function notify(title, body) {
  const n = new Notification();
  n.title = title;
  n.body = body;
  n.schedule();
}

// ── Récupérer le texte depuis le Share Sheet ──────────────────────────────────
let inputText = "";
let inputURL = "";

if (args.plainTexts && args.plainTexts.length > 0) {
  inputText = args.plainTexts[0];
}
if (args.urls && args.urls.length > 0) {
  inputURL = args.urls[0].absoluteString;
}
if (args.fileURLs && args.fileURLs.length > 0) {
  try {
    const fm = FileManager.iCloud();
    inputText = fm.readString(args.fileURLs[0].path);
  } catch (e) {}
}

// Fallback presse-papier
if (!inputText && !inputURL) {
  inputText = Pasteboard.paste() || "";
}

// ── Valider ───────────────────────────────────────────────────────────────────
if (!inputText && !inputURL) {
  notify("Y-OS Mem0 ✗", "Aucun texte reçu. Share du texte depuis une app LLM.");
  Script.complete();
}

// ── Détecter la source LLM ───────────────────────────────────────────────────
function detectSource(text, url) {
  const s = ((url || "") + " " + (text || "")).toLowerCase();
  if (s.includes("chatgpt.com") || s.includes("chat.openai.com")) return "chatgpt";
  if (s.includes("claude.ai")) return "claude";
  if (s.includes("grok.com") || s.includes("x.ai")) return "grok";
  if (s.includes("gemini.google.com")) return "gemini";
  if (s.includes("perplexity.ai")) return "perplexity";
  if (s.includes("manus.im") || s.includes("manus.computer")) return "manus";
  if (s.includes("copilot.microsoft.com")) return "copilot";
  return "unknown";
}

const source = detectSource(inputText, inputURL);

// ── Push vers le webhook Y-OS ─────────────────────────────────────────────────
async function pushToWebhook() {
  const payload = {
    text: inputText || inputURL,
    url: inputURL || "",
    source,
    user_id: CONFIG.userId
  };

  const req = new Request(CONFIG.webhook);
  req.method = "POST";
  req.headers = { "Content-Type": "application/json" };
  req.body = JSON.stringify(payload);
  req.timeoutInterval = 15;

  try {
    const res = await req.loadJSON();
    return res;
  } catch (e) {
    return await pushDirectToMem0();
  }
}

async function pushDirectToMem0() {
  const messages = [{ role: "user", content: inputText || inputURL }];

  const req = new Request("https://api.mem0.ai/v1/memories/");
  req.method = "POST";
  req.headers = {
    "Authorization": `Token ${CONFIG.mem0Token}`,
    "Content-Type": "application/json"
  };
  req.body = JSON.stringify({
    messages,
    user_id: CONFIG.userId,
    metadata: { source, url: inputURL }
  });
  req.timeoutInterval = 15;

  const res = await req.loadJSON();
  return {
    ok: true,
    memories_created: Array.isArray(res) ? res.length : 1,
    source,
    fallback: true
  };
}

// ── Exécuter ──────────────────────────────────────────────────────────────────
try {
  const result = await pushToWebhook();
  if (result && result.ok) {
    const n = result.memories_created || "?";
    const via = result.fallback ? "direct" : "webhook";
    notify(`Y-OS Mem0 ✓ — ${source.toUpperCase()}`, `${n} mémoire(s) indexée(s) [${via}]`);
  } else {
    notify("Y-OS Mem0 ✗", result?.error || "Push échoué");
  }
} catch (e) {
  notify("Y-OS Mem0 ✗", `Erreur : ${e.message}`);
}

Script.complete();
