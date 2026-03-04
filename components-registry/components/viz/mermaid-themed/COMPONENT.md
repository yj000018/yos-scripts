# viz-mermaid-themed — Fiche Composant yOS

**ID** : `viz-mermaid-themed`  
**Version** : `0.9.0`  
**Catégorie** : `VIZ`  
**Layer** : `2` (Renderer)  
**Statut** : `beta`  
**Auteur** : Manus  
**Créé** : 2025-11-15  
**Mis à jour** : 2026-03-04  
**GitHub** : https://github.com/yj000018/yos-components/tree/main/components/viz/mermaid-themed/  

---

## 1. Objectif

Rendu de diagrammes Mermaid avec le thème visuel yOS canonique (dark/light/custom). Produit SVG ou PNG haute résolution avec header/footer brandés yOS. Composant de référence du registry — premier composant formellement documenté.

---

## 2. Cas d'Usage

- **Cas 1** : Générer un diagramme d'architecture yOS dans une session Manus
- **Cas 2** : Exporter un schéma PNG pour documentation Notion
- **Cas 3** : Intégrer dans un Report Builder (Layer 3)

---

## 3. Interface I/O

### 3.1 Inputs

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|:------:|--------|-------------|
| `mermaid_code` | `str` | ✅ | — | Code Mermaid valide |
| `theme` | `str` | ❌ | `'dark'` | `'dark'` \| `'light'` \| `'yos'` |
| `output_format` | `str` | ❌ | `'svg'` | `'svg'` \| `'png'` |
| `title` | `str` | ❌ | `''` | Titre du diagramme (header) |
| `width` | `int` | ❌ | `1200` | Largeur PNG en pixels |

### 3.2 Outputs

| Champ | Type | Description |
|-------|------|-------------|
| `svg` | `str` | SVG string |
| `png_path` | `str \| None` | Chemin PNG si `output_format='png'` |
| `error` | `str \| None` | Message d'erreur si échec |

### 3.3 Exemple minimal

```python
from yos_loader import load_component

mermaid = load_component("viz-mermaid-themed")
result = mermaid.render(
    mermaid_code="graph TD; A[Start] --> B[End]",
    theme="yos"
)
print(result.svg)
```

---

## 4. Features

| Feature | Statut | Notes |
|---------|:------:|-------|
| Thème dark yOS | ✅ stable | Palette canonique |
| Thème light | ✅ stable | |
| Thème yos (branded) | 🔄 beta | Header/footer yOS |
| Export PNG | ✅ stable | 180dpi |
| Export SVG | ✅ stable | |
| Tous types Mermaid | ✅ stable | flowchart, sequence, er, gantt... |

---

## 5. Limites Connues

- Ne supporte pas les diagrammes Mermaid > 500 nœuds (performance)
- Le thème `yos` branded nécessite `yos_renderer_v4.py` dans le path

---

## 6. Décisions Prises

| # | Décision | Justification | Date |
|---|----------|---------------|------|
| D1 | Basé sur `mermaid-cli` + `yos_renderer_v4` | Contrôle total du rendu, thème custom | 2025-11-15 |
| D2 | SVG par défaut, PNG optionnel | SVG = scalable, PNG = export Notion | 2025-11-15 |

---

## 7. Source Code

- **Entry point** : `index.py`
- **Tests** : `tests/test_mermaid_themed.py`
- **Schema** : `schema.json`

---

## 8. Historique des Versions

| Version | Date | Changements |
|---------|------|-------------|
| 0.9.0 | 2026-02-20 | Thème yOS branded |
| 0.5.0 | 2025-12-10 | Export PNG |
| 0.1.0 | 2025-11-15 | Initial release |

---

*Tag : Manus | Projet : yOS Components Registry*
