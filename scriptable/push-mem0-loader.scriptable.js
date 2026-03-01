// Y-OS Memory Bridge — Loader v1.2
// ▶ CE fichier est le seul à installer dans Scriptable (Share Sheet activé)
// ▶ Corrections v1.2 :
//   - eval() au lieu de importModule() — seule méthode fiable depuis Share Sheet
//   - Keychain pour le cache — accessible depuis tous les contextes Scriptable
//   - Injection du texte partagé via globalThis._yosInputText

const GITHUB_RAW = "https://raw.githubusercontent.com/yj000018/yos-scripts/main/scriptable/push-mem0.scriptable.js";
const CACHE_KEY = "yos_push_mem0_cache_v6";
const LOADER_VERSION = "1.2";

// ── Notification d'erreur ─────────────────────────────────────────────────────
async function notifyError(title, body) {
  const n = new Notification();
  n.title = title;
  n.body = body;
  await n.schedule();
}

// ── Télécharger le script principal depuis GitHub ─────────────────────────────
async function fetchScript() {
  try {
    const req = new Request(GITHUB_RAW);
    req.timeoutInterval = 12;
    const code = await req.loadString();
    if (code && code.length > 200) {
      Keychain.set(CACHE_KEY, code);
      return code;
    }
    throw new Error("Réponse GitHub vide ou trop courte");
  } catch (e) {
    // Fallback cache Keychain
    if (Keychain.contains(CACHE_KEY)) {
      return Keychain.get(CACHE_KEY);
    }
    throw new Error("Réseau indisponible + cache absent: " + e.message);
  }
}

// ── Récupérer le texte d'entrée (Share Sheet ou clipboard) ───────────────────
function getInputText() {
  if (args.plainTexts && args.plainTexts.length > 0 && args.plainTexts[0].trim()) {
    return args.plainTexts[0];
  }
  if (args.urls && args.urls.length > 0) {
    return args.urls[0];
  }
  // Fallback clipboard
  const clip = Pasteboard.paste();
  return clip || "";
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const inputText = getInputText();

  // Télécharger / mettre à jour le script principal
  let code;
  try {
    code = await fetchScript();
  } catch (e) {
    await notifyError("❌ Y-OS Loader v" + LOADER_VERSION, e.message);
    Script.complete();
    return;
  }

  // Injecter les variables globales avant eval
  // Le script principal lit globalThis._yosInputText et globalThis._yosLoaderVersion
  globalThis._yosInputText = inputText;
  globalThis._yosLoaderVersion = LOADER_VERSION;

  // Exécuter le script principal via eval (compatible Share Sheet)
  try {
    eval(code); // eslint-disable-line no-eval
  } catch (e) {
    await notifyError("❌ Y-OS Script Error v" + LOADER_VERSION, String(e.message || e).substring(0, 120));
  }

  Script.complete();
}

await main();
