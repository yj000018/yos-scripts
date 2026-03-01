// Y-OS Push to Mem0 v4.0 — Direct Mem0, no webhook, no loader
// Coller directement dans Scriptable. Activer "Show in Share Sheet".

const MEM0_TOKEN = "m0-2M5Fyr4gVUtE0i4tHKfdkYbdDrqBArBiv5c11fUp";
const USER_ID = "yannick-yos";

// ── Input ─────────────────────────────────────────────────────────────────────
let text = args.plainTexts?.[0] || "";
let url  = args.urls?.[0]?.absoluteString || "";
if (!text && !url) text = Pasteboard.paste() || "";

if (!text && !url) {
  let n = new Notification();
  n.title = "Y-OS Mem0";
  n.body  = "Aucun texte reçu.";
  await n.schedule();
  Script.complete();
}

// ── Source detection ──────────────────────────────────────────────────────────
const s = (url + " " + text).toLowerCase();
const source = s.includes("chatgpt") || s.includes("openai") ? "chatgpt"
  : s.includes("claude")      ? "claude"
  : s.includes("grok")        ? "grok"
  : s.includes("gemini")      ? "gemini"
  : s.includes("perplexity")  ? "perplexity"
  : s.includes("manus")       ? "manus"
  : "unknown";

// ── Push to Mem0 ──────────────────────────────────────────────────────────────
const req = new Request("https://api.mem0.ai/v1/memories/");
req.method = "POST";
req.headers = {
  "Authorization": "Token " + MEM0_TOKEN,
  "Content-Type": "application/json"
};
req.body = JSON.stringify({
  messages: [{ role: "user", content: text || url }],
  user_id: USER_ID,
  metadata: { source, url }
});
req.timeoutInterval = 20;

try {
  const res = await req.loadJSON();
  const count = Array.isArray(res) ? res.length : (res?.results?.length || 1);
  let n = new Notification();
  n.title = "✓ Mem0 — " + source.toUpperCase();
  n.body  = count + " mémoire(s) indexée(s)";
  await n.schedule();
} catch(e) {
  let n = new Notification();
  n.title = "✗ Mem0 erreur";
  n.body  = String(e.message || e);
  await n.schedule();
}

Script.complete();
