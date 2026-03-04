# yOS Components Registry

**Version** : 0.1.0 | **Date** : 2026-03-04 | **Tag** : Manus

> Index humain du registry. Source de vérité machine : `registry.json`. Documentation complète : `YOS_COMPONENTS_REGISTRY_ARCHITECTURE.md`.

---

## Composants par Statut

### Beta (production-ready, en validation)

| ID | Nom | Cat | L | Version | Priorité | Notes |
|----|-----|:---:|:-:|---------|:--------:|-------|
| `viz-mermaid-themed` | Mermaid Themed Renderer | VIZ | 2 | 0.9.0 | P0 | Composant de référence yOS |

### Draft (en développement)

| ID | Nom | Cat | L | Version | Priorité | Notes |
|----|-----|:---:|:-:|---------|:--------:|-------|
| `cog-mmm` | MMM — Mind Map Manus | COG | 2 | 0.1.0 | P0 | Priorité haute |
| `nav-treeview` | TreeView Navigator | NAV | 2 | 0.1.0 | P1 | |
| `sel-picklist` | PickList Selector | SEL | 1 | 0.1.0 | P1 | Primitive fondamentale |
| `dat-timeline` | Timeline Renderer | DAT | 2 | 0.1.0 | P2 | |
| `sel-tagpicker` | Tag Picker | SEL | 1 | 0.1.0 | P2 | Lié à memory-manager |
| `viz-d2-renderer` | D2 Diagram Renderer | VIZ | 2 | 0.1.0 | P2 | |
| `sys-notion-block` | Notion Block Exporter | SYS | 2 | 0.1.0 | P3 | |

---

## Catégories

| Code | Nom | Description |
|------|-----|-------------|
| `VIZ` | Visualization | Rendu graphique de données |
| `NAV` | Navigation | Exploration de structures |
| `SEL` | Selection | Choix et filtrage |
| `DAT` | Data Display | Présentation structurée |
| `COG` | Cognitive | Outils de pensée |
| `INT` | Interaction | Éléments d'interface |
| `SYS` | Integration | Connecteurs systèmes |

## Layers

| Layer | Nom | Description |
|:-----:|-----|-------------|
| 1 | Primitives | Unités atomiques |
| 2 | Renderers | Transformation data → visuel |
| 3 | Composites | Assemblages de primitives |
| 4 | Workflows | Séquences orchestrées |

---

## Utilisation Rapide

```python
from yos_loader import load_component, list_components, registry_status

# Voir le statut du registry
registry_status()

# Lister les composants stables
comps = list_components(status="stable")

# Charger un composant
mermaid = load_component("viz-mermaid-themed")
```

---

## Fichiers du Registry

| Fichier | Rôle |
|---------|------|
| `registry.json` | Index machine-readable (source de vérité) |
| `REGISTRY.md` | Ce fichier — index humain |
| `COMPONENT_TEMPLATE.md` | Template canonique pour nouvelles fiches |
| `yos_loader.py` | Loader Python avec cache |
| `YOS_COMPONENTS_REGISTRY_ARCHITECTURE.md` | Document d'architecture complet |
| `interrelations.png` | Carte des interrelations composants |
| `lifecycle.png` | Diagramme cycle de vie |
| `git-loader-arch.png` | Architecture Git/Loader |

---

*Tag : Manus | Projet : yOS Components Registry*
