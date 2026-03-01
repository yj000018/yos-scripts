// Y-OS Mem0 Loader v1.1 — Auto-update depuis GitHub
// ▶ CE fichier est le seul à installer dans Scriptable (Share Sheet activé)
// ▶ Il télécharge et met à jour push-mem0.scriptable.js automatiquement
// ▶ Corrections v1.1 :
//   - FileManager.local() au lieu d'iCloud (évite les échecs si iCloud Drive désactivé)
//   - Notification d'erreur explicite si cache absent après tentative de download
//   - Messages d'erreur plus précis pour faciliter le debug

const GITHUB_RAW = "https://raw.githubusercontent.com/yj000018/yos-scripts/main/scriptable/push-mem0.scriptable.js";
const CACHE_NAME = "push-mem0-cache"; // nom du script dans Scriptable

// ── Mise à jour du cache depuis GitHub ───────────────────────────────────────
async function updateCache() {
  try {
    const req = new Request(GITHUB_RAW);
    req.timeoutInterval = 10;
    const code = await req.loadString();
    if (code && code.includes("module.exports")) {
      const fm = FileManager.local();
      const dir = fm.documentsDirectory();
      const path = fm.joinPath(dir, CACHE_NAME + ".js");
      fm.writeString(path, code);
      return true;
    }
  } catch (e) {
    // Silencieux — on utilisera le cache existant si disponible
  }
  return false;
}

// ── Vérifier que le cache existe ─────────────────────────────────────────────
function cacheExists() {
  try {
    const fm = FileManager.local();
    const dir = fm.documentsDirectory();
    const path = fm.joinPath(dir, CACHE_NAME + ".js");
    return fm.fileExists(path);
  } catch (e) {
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
// 1. Mise à jour du cache (non-bloquante si offline)
const updated = await updateCache();

// 2. Vérifier que le cache est disponible
if (!cacheExists()) {
  let n = new Notification();
  n.title = "Y-OS Mem0 — Erreur loader v1.1";
  n.body  = updated
    ? "Cache écrit mais introuvable. Vérifier les permissions Scriptable."
    : "Cache absent + pas de connexion. Vérifier internet.";
  await n.schedule();
  Script.complete();
  return;
}

// 3. Importer et exécuter le script principal
try {
  const main = importModule(CACHE_NAME);
  await main.run(args);
} catch (e) {
  let n = new Notification();
  n.title = "Y-OS Mem0 — Erreur loader v1.1";
  n.body  = String(e.message || e).substring(0, 150);
  await n.schedule();
}

Script.complete();
