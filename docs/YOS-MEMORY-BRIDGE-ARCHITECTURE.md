# Y-OS Memory Bridge — Architecture & Chaîne de mise à jour

**Version :** 2.2  
**Dernière mise à jour :** Mars 2026  
**Auteur système :** Manus (architecte cognitif Y-OS)  
**Propriétaire :** Yannick — Y-OS Cognitive Operating System

---

## 1. Vision

Y-OS Memory Bridge est le pont entre toutes les conversations LLM (ChatGPT, Claude, Gemini, Grok, Perplexity, Manus) et la mémoire sémantique centralisée Mem0. Chaque conversation partagée depuis iOS est automatiquement parsée, structurée, et indexée comme mémoire cognitive persistante.

**Principe fondamental :** Yannick ne touche jamais aux scripts. Manus gère toute la chaîne technique. Yannick utilise uniquement le Share Sheet iOS.

---

## 2. Architecture globale

```
iPhone (iOS)
  └── Share Sheet → [push-mem0-loader] (Scriptable)
                         │
                         ├── GitHub Raw (yj000018/yos-scripts)
                         │     └── scriptable/push-mem0.scriptable.js  ← Manus modifie ici
                         │
                         ├── Cache local Scriptable (push-mem0-cache.js)
                         │
                         └── Mem0 API (api.mem0.ai)
                                  │
                                  └── user_id: "yannick"
                                        └── Mémoires sémantiques indexées

Web Dashboard (yosmembridge-xedjekw3.manus.space)
  ├── Dashboard    → Stats temps réel + auto-refresh 30s
  ├── Explorer     → Recherche sémantique + CRUD mémoires
  ├── Push Session → Ingestion manuelle multi-LLM
  ├── Guide        → Matrice iOS par LLM
  ├── iOS Setup    → Instructions installation
  └── Scripts Y-OS → Documentation technique (cette page)
```

---

## 3. Composants techniques

### 3.1 Script Loader (installé une seule fois sur iPhone)

| Propriété | Valeur |
|---|---|
| **Fichier** | `scriptable/push-mem0-loader.scriptable.js` |
| **URL GitHub** | `https://raw.githubusercontent.com/yj000018/yos-scripts/master/scriptable/push-mem0-loader.scriptable.js` |
| **Nom dans Scriptable** | `Push to Mem0` |
| **Share Sheet** | Activé |
| **Dernière installation** | Unique — jamais à refaire |
| **Responsable mise à jour** | Aucun — fichier stable |

**Comportement à chaque exécution :**

1. Contacte GitHub Raw → télécharge `push-mem0.scriptable.js`
2. Vérifie que le contenu contient `module.exports` (validation minimale)
3. Écrit en cache local : `push-mem0-cache.js` dans le dossier Scriptable iCloud
4. Importe via `importModule("push-mem0-cache")` — pas `eval()`
5. Appelle `main.run(args)` en passant les arguments Share Sheet
6. Si GitHub inaccessible (offline) → utilise le cache existant sans erreur

### 3.2 Script Principal (jamais installé manuellement)

| Propriété | Valeur |
|---|---|
| **Fichier** | `scriptable/push-mem0.scriptable.js` |
| **URL GitHub** | `https://raw.githubusercontent.com/yj000018/yos-scripts/master/scriptable/push-mem0.scriptable.js` |
| **Version actuelle** | 6.0 |
| **Responsable mise à jour** | **Manus uniquement** |
| **Déploiement** | Automatique — aucune action Yannick |

**Fonctionnalités v6.0 :**

- Détection source LLM (chatgpt, claude, grok, gemini, perplexity, manus, unknown)
- Parseur conversation multi-format : `Human/Assistant`, `You/ChatGPT`, `Vous/Claude`, `User/Assistant`, `Moi/[LLM]`
- Envoi à Mem0 sous forme de tableau `messages[]` avec rôles alternés user/assistant
- Métadonnées : `source`, `url`, `turns`, `version`
- Notification iOS : confirmation avec nombre de tours détectés
- Fallback : si aucun pattern détecté, envoi en `user` message unique

### 3.3 Mem0 Cloud

| Propriété | Valeur |
|---|---|
| **API** | `https://api.mem0.ai/v1/memories/` |
| **Authentification** | Token Bearer (stocké dans le script, géré par Manus) |
| **User ID** | `yannick` (unique, consolidé) |
| **Délai indexation** | 30-60 secondes (async, PENDING → DONE) |
| **Extraction** | Mem0 extrait automatiquement les faits sémantiques des messages |

**Règle d'architecture :** Mem0 ne stocke que du contexte sémantique (projets, décisions, préférences, architecture). Jamais de credentials, tokens, ou données sensibles.

### 3.4 Web Dashboard

| Propriété | Valeur |
|---|---|
| **URL** | `https://yosmembridge-xedjekw3.manus.space` |
| **Stack** | React 19 + TypeScript + Tailwind 4 |
| **Design** | Control Room Architectural (dark, DM Mono + DM Sans) |
| **Auto-refresh** | Dashboard toutes les 30 secondes |
| **Responsable** | Manus (développement + déploiement) |

---

## 4. Flux de mise à jour — Qui fait quoi

### 4.1 Mise à jour du script iOS (cas le plus fréquent)

```
Yannick demande une amélioration
        ↓
Manus modifie scriptable/push-mem0.scriptable.js sur GitHub
        ↓
Commit + push (Manus, avec PAT GitHub)
        ↓
Disponible immédiatement sur GitHub Raw
        ↓
Prochain Share Sheet depuis iPhone → loader télécharge automatiquement
        ↓
Yannick ne fait rien
```

**Délai de propagation :** instantané côté GitHub, effectif au prochain Share Sheet.

### 4.2 Mise à jour du Dashboard web

```
Yannick demande une amélioration
        ↓
Manus modifie le code React dans /home/ubuntu/yos-memory-bridge/
        ↓
webdev_save_checkpoint → déploiement automatique
        ↓
Disponible sur yosmembridge-xedjekw3.manus.space
        ↓
Yannick ne fait rien
```

### 4.3 Mise à jour du loader (rare — changement d'architecture)

Ce cas est exceptionnel (changement d'URL GitHub, refonte du mécanisme de cache, etc.).

```
Manus modifie push-mem0-loader.scriptable.js
        ↓
Manus pousse sur GitHub
        ↓
Manus notifie Yannick avec les instructions de réinstallation
        ↓
Yannick : 1 copier-coller dans Scriptable (5 minutes, une seule fois)
```

**Fréquence estimée :** 1-2 fois par an maximum.

---

## 5. Tableau des responsabilités

| Action | Responsable | Fréquence |
|---|---|---|
| Partager une conversation depuis iOS | Yannick | Quotidien |
| Consulter le Dashboard | Yannick | Quotidien |
| Modifier le script principal | Manus | Sur demande |
| Pousser sur GitHub | Manus | Sur demande |
| Déployer le Dashboard | Manus | Sur demande |
| Réinstaller le loader sur iPhone | Yannick | Jamais (sauf refonte) |
| Gérer les credentials Mem0 | Manus | Sur demande |
| Nettoyer les mémoires Mem0 | Yannick (via Explorer) | Occasionnel |

---

## 6. Sécurité et credentials

| Donnée | Stockage | Responsable |
|---|---|---|
| Token Mem0 API | Dans le script GitHub (repo public) | Manus — rotation si compromis |
| GitHub PAT | Utilisé ponctuellement, jamais persisté | Yannick fournit sur demande |
| Credentials personnels | 1Password uniquement | Yannick |
| Mémoires Mem0 | Contexte sémantique uniquement | Architecture rule |

> **Règle non négociable :** aucun credential, token d'accès, ou clé API ne doit jamais être poussé dans Mem0 comme mémoire. Mem0 = contexte cognitif uniquement.

---

## 7. URLs de référence

| Ressource | URL |
|---|---|
| Dashboard Y-OS | https://yosmembridge-xedjekw3.manus.space |
| Repo GitHub scripts | https://github.com/yj000018/yos-scripts |
| Script loader (raw) | https://raw.githubusercontent.com/yj000018/yos-scripts/master/scriptable/push-mem0-loader.scriptable.js |
| Script principal (raw) | https://raw.githubusercontent.com/yj000018/yos-scripts/master/scriptable/push-mem0.scriptable.js |
| Mem0 API docs | https://docs.mem0.ai |

---

## 8. Historique des versions

| Version | Date | Changements |
|---|---|---|
| v1.0 | Fév 2026 | Dashboard initial, 4 modules, design Control Room |
| v1.1 | Fév 2026 | Push cross-LLM, import JSON ChatGPT/Claude, parseur multi-format |
| v1.2 | Fév 2026 | iOS Setup, raccourci Shortcuts, matrice compatibilité LLM |
| v1.3-1.5 | Fév 2026 | Corrections Grok/Gemini iOS, tests réels, tableau refondé |
| v2.0 | Fév 2026 | Webhook Fly.io, script Tampermonkey, script Scriptable v4 |
| v2.1 | Mar 2026 | Dashboard auto-refresh 30s, Scriptable v5 parseur multi-tours |
| v2.2 | Mar 2026 | Loader auto-update (bootstrap + importModule), Scriptable v6 |

---

*Document maintenu par Manus — architecte cognitif Y-OS.*  
*Dernière mise à jour automatique à chaque évolution de l'architecture.*
