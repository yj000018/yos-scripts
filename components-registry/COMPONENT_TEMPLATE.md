# {COMPONENT_NAME} — Fiche Composant yOS

> **Template canonique v1.0** — Copier ce fichier, renommer en `COMPONENT.md`, remplir tous les champs.

**ID** : `{category-code}-{slug}`  
**Version** : `0.1.0`  
**Catégorie** : `{VIZ | NAV | SEL | DAT | COG | INT | SYS}`  
**Layer** : `{1 | 2 | 3 | 4}`  
**Statut** : `draft`  
**Auteur** : Manus  
**Créé** : YYYY-MM-DD  
**Mis à jour** : YYYY-MM-DD  
**GitHub** : https://github.com/yannick/yos-components/tree/main/components/{category}/{slug}/  
**Notion** : {URL_NOTION}  

---

## 1. Objectif

> 1 à 3 phrases. Ce que fait ce composant. Pourquoi il existe dans yOS. Quel problème il résout.

{DESCRIPTION}

---

## 2. Cas d'Usage

> Situations concrètes où ce composant est la solution optimale.

- **Cas 1** : {description}
- **Cas 2** : {description}
- **Cas 3** : {description}

---

## 3. Interface I/O

### 3.1 Inputs

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|:------:|--------|-------------|
| `param_1` | `str` | ✅ | — | {description} |
| `param_2` | `dict` | ❌ | `{}` | {description} |
| `param_3` | `bool` | ❌ | `True` | {description} |

### 3.2 Outputs

| Champ | Type | Description |
|-------|------|-------------|
| `result_1` | `str` | {description} |
| `result_2` | `bool` | {description} |
| `error` | `str \| None` | Message d'erreur si échec, sinon `None` |

### 3.3 Exemple d'appel minimal

```python
# Import via yOS loader
from yos_loader import load_component

comp = load_component("{category-code}-{slug}")
result = comp.render(
    param_1="...",
)
print(result.result_1)
```

### 3.4 Exemple d'appel complet

```python
from yos_loader import load_component

comp = load_component("{category-code}-{slug}", version="1.0.0")
result = comp.render(
    param_1="...",
    param_2={"key": "value"},
    param_3=False
)

if result.error:
    print(f"Error: {result.error}")
else:
    print(result.result_1)
```

---

## 4. Manuel d'Utilisation

### 4.1 Prérequis & Installation

```bash
# Dépendances Python
pip install {package_1} {package_2}

# Variables d'environnement requises
export {ENV_VAR}="{value}"
```

### 4.2 Usage de base

```python
# Exemple commenté pas à pas
{CODE_EXAMPLE}
```

### 4.3 Options avancées

{ADVANCED_USAGE}

### 4.4 Intégration avec d'autres composants yOS

```python
# Exemple d'intégration avec {other_component}
{INTEGRATION_EXAMPLE}
```

---

## 5. Features

| Feature | Statut | Version | Notes |
|---------|:------:|---------|-------|
| {Feature A} | ✅ stable | v1.0.0 | {notes} |
| {Feature B} | 🔄 beta | v1.1.0 | {notes} |
| {Feature C} | 📋 planned | v2.0.0 | {notes} |

**Légende** : ✅ stable · 🔄 beta · 📋 planned · ❌ deprecated

---

## 6. Limites Connues

> Ce que ce composant NE fait PAS. Contraintes techniques. Cas non supportés.

- **Limite 1** : {description}
- **Limite 2** : {description}
- **Limite 3** : {description}

---

## 7. Décisions Prises

> Choix d'architecture ou de design significatifs, avec justification. Évite les questions répétées.

| # | Décision | Justification | Alternatives rejetées | Date |
|---|----------|---------------|----------------------|------|
| D1 | {décision} | {justification} | {alternatives} | YYYY-MM-DD |
| D2 | {décision} | {justification} | {alternatives} | YYYY-MM-DD |

---

## 8. Issues & Bugs Connus

| ID | Sévérité | Description | Workaround | Statut |
|----|:--------:|-------------|------------|:------:|
| B1 | 🔴 critical | {description} | {workaround} | open |
| B2 | 🟡 medium | {description} | {workaround} | open |
| B3 | 🟢 low | {description} | — | backlog |

**Sévérité** : 🔴 critical · 🟠 high · 🟡 medium · 🟢 low

---

## 9. Roadmap

| Version cible | Feature | Priorité | Statut |
|---------------|---------|:--------:|:------:|
| v1.1.0 | {feature} | P1 | 📋 planned |
| v1.2.0 | {feature} | P2 | 📋 planned |
| v2.0.0 | {feature} | P3 | 💭 idea |

---

## 10. Interrelations

```
{SCHEMA_ASCII_OU_MERMAID}
```

| Composant | Relation | Direction | Notes |
|-----------|----------|:---------:|-------|
| `{comp-id}` | dépend de | → | {notes} |
| `{comp-id}` | utilisé par | ← | {notes} |
| `{comp-id}` | optionnel | ↔ | {notes} |

---

## 11. Source Code

```
{category}/{slug}/
├── COMPONENT.md          ← Ce fichier
├── index.{ext}           ← Entry point principal
├── schema.json           ← Interface I/O formelle (JSON Schema)
├── tests/
│   ├── test_{slug}.py    ← Tests unitaires
│   └── fixtures/         ← Données de test
├── examples/
│   ├── basic.md          ← Exemple minimal
│   └── advanced.md       ← Exemple avancé
└── versions/
    └── CHANGELOG.md      ← Historique des changements
```

- **Repo** : https://github.com/yannick/yos-components/tree/main/components/{category}/{slug}/
- **Entry point** : `index.{ext}`
- **Tests** : `tests/test_{slug}.py`
- **Schema** : `schema.json`

---

## 12. Historique des Versions

| Version | Date | Type | Changements |
|---------|------|:----:|-------------|
| 0.1.0 | YYYY-MM-DD | initial | Création du composant |

**Type** : `initial` · `feat` · `fix` · `breaking` · `docs` · `chore`

---

*Tag : Manus | Projet : yOS Components Registry*
