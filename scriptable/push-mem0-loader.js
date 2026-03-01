// Y-OS Push to Mem0 — Auto-loader
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER CE FICHIER dans Scriptable (pas push-mem0.scriptable.js)
// Le script complet se charge depuis GitHub à chaque exécution.
// Mise à jour automatique : aucun réimport nécessaire.
//
// Installation :
//   1. Scriptable → + → coller ce code → nommer "Push to Mem0"
//   2. Paramètres du script → activer "Show in Share Sheet"
//   3. Share (↑) depuis n'importe quelle app → Scriptable → Push to Mem0
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT_URL = "https://raw.githubusercontent.com/yj000018/yos-scripts/main/scriptable/push-mem0.scriptable.js";

try {
  const req = new Request(SCRIPT_URL);
  req.timeoutInterval = 10;
  const code = await req.loadString();
  if (!code || code.length < 100) throw new Error("Script vide ou inaccessible");
  eval(code);
} catch (e) {
  const alert = new Alert();
  alert.title = "Y-OS Mem0 — Erreur loader";
  alert.message = `Impossible de charger le script depuis GitHub.\n\nErreur : ${e.message}\n\nVérifier la connexion internet.`;
  alert.addAction("OK");
  await alert.present();
}
