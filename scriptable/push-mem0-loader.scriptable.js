// Y-OS Mem0 Loader v1.0 — Auto-update depuis GitHub
// ▶ CE fichier est le seul à installer dans Scriptable (Share Sheet activé)
// ▶ Il télécharge et met à jour push-mem0.scriptable.js automatiquement
// ▶ Zéro intervention manuelle pour les mises à jour futures

const GITHUB_RAW = "https://raw.githubusercontent.com/yj000018/yos-scripts/main/scriptable/push-mem0.scriptable.js";
const CACHE_NAME = "push-mem0-cache"; // nom du script caché dans Scriptable

// ── Mise à jour silencieuse en arrière-plan ──────────────────────────────────
async function updateCache() {
  try {
    const req = new Request(GITHUB_RAW);
    req.timeoutInterval = 8;
    const code = await req.loadString();
    if (code && code.includes("module.exports")) {
      // Écrire dans le dossier Scriptable local via FileManager
      const fm = FileManager.iCloud();
      const dir = fm.documentsDirectory();
      const path = fm.joinPath(dir, CACHE_NAME + ".js");
      fm.writeString(path, code);
      return true;
    }
  } catch (e) {
    // Silencieux — on utilisera le cache existant
  }
  return false;
}

// ── Vérifier que le cache existe ────────────────────────────────────────────
function cacheExists() {
  try {
    const fm = FileManager.iCloud();
    const dir = fm.documentsDirectory();
    const path = fm.joinPath(dir, CACHE_NAME + ".js");
    return fm.fileExists(path);
  } catch (e) {
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
// 1. Mise à jour du cache (non-bloquante si offline)
await updateCache();

// 2. Vérifier que le cache est disponible
if (!cacheExists()) {
  let n = new Notification();
  n.title = "Y-OS Mem0 — Erreur";
  n.body  = "Cache absent. Vérifier la connexion internet.";
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
  n.title = "Y-OS Mem0 — Erreur loader";
  n.body  = String(e.message || e).substring(0, 120);
  await n.schedule();
}

Script.complete();
