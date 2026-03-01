// Y-OS Push to Mem0 — Scriptable iOS
// Version: 3.0.0
// Déclencheur: Share Sheet (texte ou URL depuis n'importe quelle app iOS)
// Installation: Scriptable app → + → coller ce code → nommer "Push to Mem0"
// Usage: Share Sheet depuis ChatGPT/Claude/Grok/Gemini/Perplexity → Scriptable → Push to Mem0

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  webhook: "https://yos-push-webhook.fly.dev/push",
  mem0Token: "m0-2M5Fyr4gVUtE0i4tHKfdkYbdDrqBArBiv5c11fUp",
  userId: "yannick-yos"
};

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
  // Fichier texte partagé
  try {
    const fm = FileManager.iCloud();
    inputText = fm.readString(args.fileURLs[0].path);
  } catch (e) {}
}

// Si rien reçu, lire le presse-papier
if (!inputText && !inputURL) {
  inputText = Pasteboard.paste() || "";
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

// ── Valider le contenu ───────────────────────────────────────────────────────
if (!inputText && !inputURL) {
  const alert = new Alert();
  alert.title = "Y-OS Mem0";
  alert.message = "Aucun texte reçu. Utilise le Share Sheet depuis une app LLM, ou copie du texte d'abord.";
  alert.addAction("OK");
  await alert.present();
  Script.complete();
}

// ── Afficher confirmation avant push ─────────────────────────────────────────
const preview = inputText ? inputText.substring(0, 200) + (inputText.length > 200 ? "..." : "") : inputURL;
const confirmAlert = new Alert();
confirmAlert.title = `Push to Mem0 — ${source.toUpperCase()}`;
confirmAlert.message = `Contenu à indexer :\n\n${preview}`;
confirmAlert.addAction("Push →");
confirmAlert.addCancelAction("Annuler");

const confirmed = await confirmAlert.present();
if (confirmed === -1) {
  Script.complete();
}

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
    // Fallback: push directement à Mem0
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

// ── Exécuter le push ──────────────────────────────────────────────────────────
let result;
try {
  result = await pushToWebhook();
} catch (e) {
  const errAlert = new Alert();
  errAlert.title = "Erreur";
  errAlert.message = `Push échoué : ${e.message}`;
  errAlert.addAction("OK");
  await errAlert.present();
  Script.complete();
}

// ── Notification de succès ────────────────────────────────────────────────────
if (result && result.ok) {
  const n = result.memories_created || "?";
  const fallbackNote = result.fallback ? " (direct Mem0)" : " (via webhook)";
  
  const successAlert = new Alert();
  successAlert.title = "✓ Mem0 — Indexé";
  successAlert.message = `${n} mémoire(s) créée(s) depuis ${source.toUpperCase()}${fallbackNote}`;
  successAlert.addAction("OK");
  await successAlert.present();
} else {
  const errAlert = new Alert();
  errAlert.title = "Erreur Mem0";
  errAlert.message = result?.error || "Push échoué";
  errAlert.addAction("OK");
  await errAlert.present();
}

Script.complete();
