"""
yOS Renderer v4 — Architecture Diagram Generator
==================================================
Renderer Python custom basé sur matplotlib.
Thème canonique yOS — défini dans dictionnaire T.
Produit PNG 180dpi avec header/footer brandés, légende intégrée, code couleur sémantique.

Canon permanent — Source de vérité : Notion > 🗺️ yOS Diagram Theme — Architecture Diagrams
Tag: Manus | Projet: yOS Components Registry
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe
import numpy as np
from pathlib import Path
from typing import Optional

# ─── Thème canonique yOS ──────────────────────────────────────────────────────
# Source de vérité. Modifier ici pour changer le thème globalement.

T = {
    # Header / Footer
    "header_bg":        "#1C3557",   # Dark navy
    "header_text":      "#FFFFFF",
    "header_sub_bg":    "#E8EEF5",   # Subtitle strip
    "header_sub_text":  "#2C3E50",
    "footer_bg":        "#F5F7FA",
    "footer_text":      "#8A9BB0",

    # Canvas
    "canvas_bg":        "#FAFBFC",
    "group_border":     "#CBD5E0",
    "group_bg":         "#F0F4F8",
    "group_label":      "#5A6A7A",

    # Nœuds — palette sémantique
    "node_colors": {
        "ui_profile":       {"bg": "#DFF0FB", "border": "#4A8EC2", "label": "UI / Profile"},
        "native_mem":       {"bg": "#EDE7F6", "border": "#7B5EA7", "label": "Native Memory"},
        "storage_notion":   {"bg": "#E3F5E8", "border": "#4A9A6A", "label": "Storage / Notion"},
        "archive":          {"bg": "#EAF0FF", "border": "#5070C4", "label": "Archive"},
        "tools":            {"bg": "#FFF5D6", "border": "#C4961A", "label": "Tools / Scripts"},
        "clients":          {"bg": "#FDEAF0", "border": "#C05070", "label": "Clients / UI"},
        "cloud":            {"bg": "#FDEAEA", "border": "#C05050", "label": "Cloud / External"},
        "workflow":         {"bg": "#F0FFF4", "border": "#38A169", "label": "Workflow"},
        "registry":         {"bg": "#EFF6FF", "border": "#3B82F6", "label": "Registry"},
        "primitive":        {"bg": "#F0F9FF", "border": "#0EA5E9", "label": "Primitive (L1)"},
        "renderer":         {"bg": "#F0FDF4", "border": "#22C55E", "label": "Renderer (L2)"},
        "composite":        {"bg": "#FDF4FF", "border": "#A855F7", "label": "Composite (L3)"},
        "workflow_l4":      {"bg": "#FFF7ED", "border": "#F97316", "label": "Workflow (L4)"},
        "external":         {"bg": "#F8FAFC", "border": "#94A3B8", "label": "External System"},
    },

    # Flèches
    "arrow_colors": {
        "auto":         "#4A8EC2",   # Bleu — flux automatiques
        "manual":       "#7B5EA7",   # Violet — flux manuels
        "sync":         "#4A9A6A",   # Vert — sync bidirectionnelle
        "chrome":       "#C05050",   # Rouge — extension browser
        "skill":        "#C4961A",   # Or — lien skill
        "git":          "#5070C4",   # Bleu foncé — git
        "loader":       "#0EA5E9",   # Cyan — loader
        "mcp":          "#A855F7",   # Violet — MCP
        "default":      "#64748B",   # Gris — défaut
    },

    # Typography
    "font_title":   14,
    "font_node":    8,
    "font_sub":     7,
    "font_group":   8,
    "font_legend":  7,
    "font_footer":  6.5,

    # Dimensions
    "dpi":          180,
    "header_h":     0.08,    # fraction de la hauteur totale
    "sub_h":        0.04,
    "footer_h":     0.05,
    "legend_w":     0.18,    # fraction de la largeur totale
}


# ─── Renderer Base ────────────────────────────────────────────────────────────

class YOSRenderer:
    """
    Renderer de base pour les schémas d'architecture yOS.
    Gère le canvas, header, footer, légende.
    Les sous-classes implémentent draw_content().
    """

    def __init__(
        self,
        title: str,
        subtitle: str,
        version: str = "v1.0",
        schema_name: str = "schema",
        figsize: tuple = (16, 10),
        theme: dict = None
    ):
        self.title = title
        self.subtitle = subtitle
        self.version = version
        self.schema_name = schema_name
        self.figsize = figsize
        self.T = theme or T
        self.legend_entries = []

        # Setup figure
        self.fig = plt.figure(figsize=figsize, facecolor=self.T["canvas_bg"])
        self.fig.patch.set_facecolor(self.T["canvas_bg"])

    def _draw_header(self):
        """Header navy avec titre, sous-titre et branding yOS."""
        hh = self.T["header_h"]
        sh = self.T["sub_h"]
        lw = self.T["legend_w"]

        # Header band
        header_ax = self.fig.add_axes([0, 1 - hh, 1 - lw, hh])
        header_ax.set_facecolor(self.T["header_bg"])
        header_ax.axis('off')

        # Logo Y-OS (text)
        header_ax.text(0.02, 0.5, "Y·OS", transform=header_ax.transAxes,
                      fontsize=16, fontweight='bold', color='#7B9FD4',
                      va='center', fontfamily='monospace')

        # Title
        header_ax.text(0.5, 0.55, self.title, transform=header_ax.transAxes,
                      fontsize=self.T["font_title"], fontweight='bold',
                      color=self.T["header_text"], va='center', ha='center')

        # Version + date
        from datetime import date
        date_str = date.today().strftime("%Y-%m-%d")
        header_ax.text(0.98, 0.5, f"{self.version}  ·  {date_str}",
                      transform=header_ax.transAxes,
                      fontsize=8, color='#A0B8D0', va='center', ha='right')

        # Subtitle strip
        sub_ax = self.fig.add_axes([0, 1 - hh - sh, 1 - lw, sh])
        sub_ax.set_facecolor(self.T["header_sub_bg"])
        sub_ax.axis('off')
        sub_ax.text(0.5, 0.5, self.subtitle, transform=sub_ax.transAxes,
                   fontsize=9, color=self.T["header_sub_text"],
                   va='center', ha='center', style='italic')

    def _draw_footer(self):
        """Footer avec nom schéma, version, date, confidential."""
        fh = self.T["footer_h"]
        lw = self.T["legend_w"]
        from datetime import date
        date_str = date.today().strftime("%Y-%m-%d")

        footer_ax = self.fig.add_axes([0, 0, 1 - lw, fh])
        footer_ax.set_facecolor(self.T["footer_bg"])
        footer_ax.axis('off')

        # Left: schema name
        footer_ax.text(0.02, 0.5, f"yOS Components Registry  ·  {self.schema_name}",
                      transform=footer_ax.transAxes,
                      fontsize=self.T["font_footer"], color=self.T["footer_text"],
                      va='center')

        # Center: version
        footer_ax.text(0.5, 0.5, f"{self.version}  ·  {date_str}",
                      transform=footer_ax.transAxes,
                      fontsize=self.T["font_footer"], color=self.T["footer_text"],
                      va='center', ha='center')

        # Right: confidential
        footer_ax.text(0.98, 0.5, "Confidential — yOS Internal",
                      transform=footer_ax.transAxes,
                      fontsize=self.T["font_footer"], color=self.T["footer_text"],
                      va='center', ha='right')

        # Top border line
        footer_ax.axhline(y=1.0, color=self.T["group_border"], linewidth=0.5)

    def _draw_legend(self):
        """Panneau légende à droite."""
        lw = self.T["legend_w"]
        hh = self.T["header_h"]
        sh = self.T["sub_h"]
        fh = self.T["footer_h"]

        legend_ax = self.fig.add_axes([1 - lw, 0, lw, 1])
        legend_ax.set_facecolor('#FFFFFF')
        legend_ax.axis('off')

        # Border left
        legend_ax.axvline(x=0, color=self.T["group_border"], linewidth=1)

        # Title
        legend_ax.text(0.5, 0.97, "LÉGENDE", transform=legend_ax.transAxes,
                      fontsize=8, fontweight='bold', color='#2C3E50',
                      va='top', ha='center')

        y = 0.93
        dy = 0.055

        # Node types section
        legend_ax.text(0.05, y, "Nœuds", transform=legend_ax.transAxes,
                      fontsize=7, fontweight='bold', color='#5A6A7A', va='top')
        y -= dy * 0.6

        for key, col in self.T["node_colors"].items():
            if key not in [e.get("key") for e in self.legend_entries]:
                continue
            rect = FancyBboxPatch((0.05, y - 0.025), 0.12, 0.03,
                                  boxstyle="round,pad=0.005",
                                  facecolor=col["bg"], edgecolor=col["border"],
                                  linewidth=1, transform=legend_ax.transAxes)
            legend_ax.add_patch(rect)
            legend_ax.text(0.22, y - 0.01, col["label"],
                          transform=legend_ax.transAxes,
                          fontsize=self.T["font_legend"], color='#2C3E50', va='center')
            y -= dy * 0.85
            if y < 0.1:
                break

        # Arrow types section
        y -= dy * 0.3
        legend_ax.text(0.05, y, "Flux", transform=legend_ax.transAxes,
                      fontsize=7, fontweight='bold', color='#5A6A7A', va='top')
        y -= dy * 0.6

        arrow_labels = {
            "auto":   "Automatique",
            "manual": "Manuel",
            "sync":   "Sync bidirectionnel",
            "skill":  "Lien Skill",
            "loader": "Loader",
            "mcp":    "MCP",
            "git":    "Git",
        }
        for atype, label in arrow_labels.items():
            if atype not in [e.get("arrow") for e in self.legend_entries]:
                continue
            color = self.T["arrow_colors"].get(atype, self.T["arrow_colors"]["default"])
            legend_ax.annotate("", xy=(0.18, y - 0.01), xytext=(0.05, y - 0.01),
                              transform=legend_ax.transAxes,
                              arrowprops=dict(arrowstyle='->', color=color, lw=1.5))
            legend_ax.text(0.22, y - 0.01, label,
                          transform=legend_ax.transAxes,
                          fontsize=self.T["font_legend"], color='#2C3E50', va='center')
            y -= dy * 0.85
            if y < 0.05:
                break

    def get_content_axes(self) -> plt.Axes:
        """Retourne l'axes de contenu principal (zone centrale)."""
        hh = self.T["header_h"]
        sh = self.T["sub_h"]
        fh = self.T["footer_h"]
        lw = self.T["legend_w"]

        content_ax = self.fig.add_axes(
            [0.01, fh + 0.01, 1 - lw - 0.02, 1 - hh - sh - fh - 0.02]
        )
        content_ax.set_facecolor(self.T["canvas_bg"])
        content_ax.set_xlim(0, 1)
        content_ax.set_ylim(0, 1)
        content_ax.axis('off')
        return content_ax

    def draw_node(self, ax, x, y, w, h, title, subtitle="", node_type="tools",
                  fontsize=None):
        """Dessine un nœud rectangulaire arrondi."""
        colors = self.T["node_colors"].get(node_type, self.T["node_colors"]["tools"])
        fs = fontsize or self.T["font_node"]

        rect = FancyBboxPatch((x - w/2, y - h/2), w, h,
                              boxstyle="round,pad=0.008",
                              facecolor=colors["bg"],
                              edgecolor=colors["border"],
                              linewidth=1.5,
                              transform=ax.transAxes,
                              zorder=3)
        rect.set_path_effects([pe.withSimplePatchShadow(offset=(0.003, -0.003),
                                                         shadow_rgbFace='#C0C8D0',
                                                         alpha=0.4)])
        ax.add_patch(rect)

        # Title
        ax.text(x, y + (0.008 if subtitle else 0), title,
               transform=ax.transAxes,
               fontsize=fs, fontweight='bold', color='#1A2A3A',
               va='center', ha='center', zorder=4,
               wrap=True)

        # Subtitle
        if subtitle:
            ax.text(x, y - 0.022, subtitle,
                   transform=ax.transAxes,
                   fontsize=fs - 1, color='#5A6A7A',
                   va='center', ha='center', zorder=4)

        # Track for legend
        if {"key": node_type} not in self.legend_entries:
            self.legend_entries.append({"key": node_type})

    def draw_arrow(self, ax, x1, y1, x2, y2, arrow_type="default",
                   label="", style="->", dashed=False):
        """Dessine une flèche entre deux points."""
        color = self.T["arrow_colors"].get(arrow_type, self.T["arrow_colors"]["default"])
        ls = '--' if dashed else '-'

        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                   transform=ax.transAxes,
                   arrowprops=dict(
                       arrowstyle=style,
                       color=color,
                       lw=1.5,
                       linestyle=ls,
                       connectionstyle="arc3,rad=0.05"
                   ), zorder=2)

        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            ax.text(mx, my + 0.015, label,
                   transform=ax.transAxes,
                   fontsize=6, color=color, ha='center', va='bottom',
                   bbox=dict(boxstyle='round,pad=0.1', facecolor='white',
                            edgecolor=color, alpha=0.8, linewidth=0.5),
                   zorder=5)

        if {"arrow": arrow_type} not in self.legend_entries:
            self.legend_entries.append({"arrow": arrow_type})

    def draw_group(self, ax, x, y, w, h, label):
        """Dessine un groupe avec bordure pointillée."""
        rect = FancyBboxPatch((x, y), w, h,
                              boxstyle="round,pad=0.01",
                              facecolor=self.T["group_bg"],
                              edgecolor=self.T["group_border"],
                              linewidth=1, linestyle='--',
                              transform=ax.transAxes,
                              alpha=0.5, zorder=1)
        ax.add_patch(rect)
        ax.text(x + 0.01, y + h - 0.01, label,
               transform=ax.transAxes,
               fontsize=self.T["font_group"], color=self.T["group_label"],
               fontweight='bold', va='top', zorder=2)

    def render(self, output_path: str) -> str:
        """Génère le PNG final."""
        self._draw_header()
        self._draw_footer()
        ax = self.get_content_axes()
        self.draw_content(ax)
        self._draw_legend()

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        self.fig.savefig(output_path, dpi=self.T["dpi"],
                        bbox_inches='tight', facecolor=self.T["canvas_bg"])
        plt.close(self.fig)
        print(f"[yOS Renderer] ✓ PNG saved: {output_path}")
        return output_path

    def draw_content(self, ax: plt.Axes):
        """Override dans les sous-classes pour dessiner le contenu."""
        raise NotImplementedError


# ─── Schéma 1 : Interrelations Composants ─────────────────────────────────────

class ComponentsInterrelationsRenderer(YOSRenderer):

    def __init__(self):
        super().__init__(
            title="yOS Components Registry — Interrelations",
            subtitle="Architecture modulaire en 4 layers : Primitives → Renderers → Composites → Workflows",
            version="v1.0",
            schema_name="components-interrelations",
            figsize=(18, 11)
        )

    def draw_content(self, ax):
        # ── Groups ──
        self.draw_group(ax, 0.01, 0.72, 0.96, 0.25, "Layer 1 — Primitives")
        self.draw_group(ax, 0.01, 0.48, 0.96, 0.22, "Layer 2 — Renderers")
        self.draw_group(ax, 0.01, 0.26, 0.96, 0.20, "Layer 3 — Composites")
        self.draw_group(ax, 0.01, 0.06, 0.96, 0.18, "Layer 4 — Workflows")

        # ── Layer 1 — Primitives ──
        nodes_l1 = [
            (0.15, 0.845, "sel-picklist", "PickList Selector", "primitive"),
            (0.35, 0.845, "sel-tagpicker", "Tag Picker", "primitive"),
            (0.55, 0.845, "int-codeblock", "Code Block", "primitive"),
            (0.75, 0.845, "int-badge", "Badge", "primitive"),
        ]
        for x, y, name, label, ntype in nodes_l1:
            self.draw_node(ax, x, y, 0.16, 0.07, name, label, ntype)

        # ── Layer 2 — Renderers ──
        nodes_l2 = [
            (0.10, 0.60, "viz-mermaid-themed ★", "Mermaid Themed", "renderer"),
            (0.27, 0.60, "viz-d2-renderer", "D2 Renderer", "renderer"),
            (0.44, 0.60, "nav-treeview", "TreeView", "renderer"),
            (0.61, 0.60, "dat-timeline", "Timeline", "renderer"),
            (0.78, 0.60, "cog-mmm", "Mind Map Manus", "renderer"),
            (0.92, 0.60, "sys-notion-block", "Notion Block", "renderer"),
        ]
        for x, y, name, label, ntype in nodes_l2:
            self.draw_node(ax, x, y, 0.14, 0.07, name, label, ntype)

        # ── Layer 3 — Composites ──
        nodes_l3 = [
            (0.20, 0.375, "dat-dashboard", "Dashboard", "composite"),
            (0.50, 0.375, "cog-concept-map", "Concept Map", "composite"),
            (0.78, 0.375, "dat-report", "Report Builder", "composite"),
        ]
        for x, y, name, label, ntype in nodes_l3:
            self.draw_node(ax, x, y, 0.18, 0.07, name, label, ntype)

        # ── Layer 4 — Workflows ──
        nodes_l4 = [
            (0.30, 0.165, "wf-session-synthesis", "Session Synthesis", "workflow_l4"),
            (0.68, 0.165, "wf-project-report", "Project Report", "workflow_l4"),
        ]
        for x, y, name, label, ntype in nodes_l4:
            self.draw_node(ax, x, y, 0.22, 0.07, name, label, ntype)

        # ── Arrows L1 → L3 ──
        self.draw_arrow(ax, 0.15, 0.81, 0.20, 0.41, "auto")
        self.draw_arrow(ax, 0.35, 0.81, 0.20, 0.41, "auto")
        self.draw_arrow(ax, 0.55, 0.81, 0.78, 0.41, "auto")

        # ── Arrows L2 → L3 ──
        self.draw_arrow(ax, 0.10, 0.565, 0.20, 0.41, "auto")
        self.draw_arrow(ax, 0.10, 0.565, 0.78, 0.41, "auto")
        self.draw_arrow(ax, 0.44, 0.565, 0.78, 0.41, "auto")
        self.draw_arrow(ax, 0.61, 0.565, 0.78, 0.41, "auto")
        self.draw_arrow(ax, 0.61, 0.565, 0.20, 0.41, "auto")
        self.draw_arrow(ax, 0.78, 0.565, 0.50, 0.41, "auto")

        # ── Arrows L3 → L4 ──
        self.draw_arrow(ax, 0.20, 0.34, 0.30, 0.20, "auto")
        self.draw_arrow(ax, 0.78, 0.34, 0.68, 0.20, "auto")
        self.draw_arrow(ax, 0.50, 0.34, 0.68, 0.20, "auto")

        # ── Skill links (dashed) ──
        self.draw_arrow(ax, 0.10, 0.565, 0.10, 0.565, "skill", dashed=True)  # placeholder
        # Skills shown as annotations
        for x, y in [(0.10, 0.60), (0.44, 0.60), (0.78, 0.60)]:
            ax.text(x, y + 0.045, "⚙ skill", transform=ax.transAxes,
                   fontsize=6, color=self.T["arrow_colors"]["skill"],
                   ha='center', va='bottom',
                   bbox=dict(boxstyle='round,pad=0.1', facecolor='#FFFBEB',
                            edgecolor=self.T["arrow_colors"]["skill"],
                            alpha=0.8, linewidth=0.5))


# ─── Schéma 2 : Cycle de Vie ──────────────────────────────────────────────────

class LifecycleRenderer(YOSRenderer):

    def __init__(self):
        super().__init__(
            title="yOS Components Registry — Cycle de Vie",
            subtitle="Statuts : draft → beta → stable → deprecated → archived",
            version="v1.0",
            schema_name="component-lifecycle",
            figsize=(16, 9)
        )

    def draw_content(self, ax):
        # States
        states = [
            (0.12, 0.55, "draft", "DRAFT\nCode partiel\nFiche requise", "tools"),
            (0.32, 0.55, "beta", "BETA\nTests OK\n3+ usages", "archive"),
            (0.52, 0.55, "stable", "STABLE\nProduction-ready\nSkill associé", "storage_notion"),
            (0.72, 0.55, "deprecated", "DEPRECATED\nRemplacé\nou obsolète", "clients"),
            (0.90, 0.55, "archived", "ARCHIVED\n6 mois\nsans usage", "cloud"),
        ]

        for x, y, sid, label, ntype in states:
            self.draw_node(ax, x, y, 0.16, 0.22, label.split('\n')[0],
                          '\n'.join(label.split('\n')[1:]), ntype, fontsize=9)

        # Main flow arrows
        for i in range(len(states) - 1):
            x1 = states[i][0] + 0.08
            x2 = states[i+1][0] - 0.08
            y = 0.55
            self.draw_arrow(ax, x1, y, x2, y, "auto")

        # Labels on main arrows
        transitions = [
            (0.22, 0.58, "Tests OK\n+ Fiche"),
            (0.42, 0.58, "3+ usages\nvalidés"),
            (0.62, 0.58, "Breaking change\nou remplacement"),
            (0.81, 0.58, "6 mois\nsans usage"),
        ]
        for x, y, label in transitions:
            ax.text(x, y, label, transform=ax.transAxes,
                   fontsize=6.5, color='#5A6A7A', ha='center', va='bottom',
                   bbox=dict(boxstyle='round,pad=0.15', facecolor='white',
                            edgecolor='#CBD5E0', alpha=0.9, linewidth=0.5))

        # Regression arrow (beta → draft)
        self.draw_arrow(ax, 0.32, 0.44, 0.12, 0.44, "manual", "Régression", dashed=True)

        # Restoration arrow (deprecated → stable)
        self.draw_arrow(ax, 0.72, 0.44, 0.52, 0.44, "manual", "Restauration", dashed=True)

        # Abandon arrow (draft → archived)
        self.draw_arrow(ax, 0.12, 0.44, 0.90, 0.30, "cloud", "Abandon", dashed=True)

        # Criteria boxes
        criteria = [
            (0.12, 0.22, "Critères d'entrée DRAFT",
             "• Idée documentée\n• Code partiel OK\n• Fiche COMPONENT.md"),
            (0.42, 0.22, "Critères STABLE",
             "• Tests complets\n• 3+ usages validés\n• 0 bug critique\n• Validation Architecte"),
            (0.75, 0.22, "Responsabilités",
             "• Architecte : validation stable\n• Manus : dev + docs\n• GitHub : code\n• Notion : docs"),
        ]
        for x, y, title, content in criteria:
            self.draw_group(ax, x - 0.13, y - 0.08, 0.26, 0.22, title)
            ax.text(x, y + 0.015, content, transform=ax.transAxes,
                   fontsize=6.5, color='#2C3E50', ha='center', va='center',
                   linespacing=1.5)


# ─── Schéma 3 : Git / Loader Architecture ────────────────────────────────────

class GitLoaderRenderer(YOSRenderer):

    def __init__(self):
        super().__init__(
            title="yOS Components Registry — Git & Loader Strategy",
            subtitle="Architecture Hybride : GitHub (source) → Cache local → Skills Manus (wrappers)",
            version="v1.0",
            schema_name="git-loader-architecture",
            figsize=(18, 10)
        )

    def draw_content(self, ax):
        # ── Columns ──
        # Col 1: Manus Session
        # Col 2: Skills (local)
        # Col 3: Cache /tmp
        # Col 4: GitHub
        # Col 5: Notion

        # Groups
        self.draw_group(ax, 0.01, 0.05, 0.17, 0.88, "Manus Session")
        self.draw_group(ax, 0.20, 0.05, 0.17, 0.88, "Skills (local)")
        self.draw_group(ax, 0.39, 0.05, 0.20, 0.88, "Cache /tmp/yos-components")
        self.draw_group(ax, 0.61, 0.05, 0.20, 0.88, "GitHub yos-components")
        self.draw_group(ax, 0.83, 0.05, 0.15, 0.88, "Notion")

        # ── Nodes ──
        # Manus Session
        self.draw_node(ax, 0.095, 0.82, 0.14, 0.08, "Session Manus", "Yannick / Agent", "clients")
        self.draw_node(ax, 0.095, 0.62, 0.14, 0.08, "load_component()", '"viz-mermaid-themed"', "tools")
        self.draw_node(ax, 0.095, 0.42, 0.14, 0.08, "component.render()", "code, theme", "tools")
        self.draw_node(ax, 0.095, 0.22, 0.14, 0.08, "Result", "SVG / PNG", "storage_notion")

        # Skills
        self.draw_node(ax, 0.285, 0.82, 0.14, 0.08, "SKILL.md", "Wrapper léger", "archive")
        self.draw_node(ax, 0.285, 0.62, 0.14, 0.08, "loader.sh", "Cache check + clone", "tools")
        self.draw_node(ax, 0.285, 0.42, 0.14, 0.08, "yos_loader.py", "Python loader", "tools")

        # Cache
        self.draw_node(ax, 0.485, 0.82, 0.16, 0.08, "Cache MISS", "Premier appel", "cloud")
        self.draw_node(ax, 0.485, 0.62, 0.16, 0.08, "Cache HIT ✓", "TTL 24h — Instant", "storage_notion")
        self.draw_node(ax, 0.485, 0.42, 0.16, 0.08, "viz-mermaid-themed/", "index.py + schema.json", "renderer")
        self.draw_node(ax, 0.485, 0.22, 0.16, 0.08, "Cache invalidation", "On new version", "tools")

        # GitHub
        self.draw_node(ax, 0.705, 0.82, 0.16, 0.08, "git clone --sparse", "~2-5s first call", "archive")
        self.draw_node(ax, 0.705, 0.62, 0.16, 0.08, "components/viz/", "mermaid-themed/ v1.2.0", "renderer")
        self.draw_node(ax, 0.705, 0.42, 0.16, 0.08, "registry.json", "Index machine", "registry")
        self.draw_node(ax, 0.705, 0.22, 0.16, 0.08, "Tag: v1.2.0", "git tag + CI/CD", "tools")

        # Notion
        self.draw_node(ax, 0.905, 0.72, 0.12, 0.08, "COMPONENT.md", "Fiche humaine", "storage_notion")
        self.draw_node(ax, 0.905, 0.52, 0.12, 0.08, "Registry Hub", "Index Notion", "storage_notion")
        self.draw_node(ax, 0.905, 0.32, 0.12, 0.08, "Memory Hub", "Archivage session", "storage_notion")

        # ── Scenario 1: Cache MISS ──
        ax.text(0.5, 0.96, "① Premier appel (cache vide)  ②  Appel suivant (cache chaud)  ③  Publication",
               transform=ax.transAxes, fontsize=8, color='#5A6A7A',
               ha='center', va='top',
               bbox=dict(boxstyle='round,pad=0.2', facecolor='#F0F4F8',
                        edgecolor='#CBD5E0', linewidth=0.5))

        # Flow ①: Session → Skill → Cache MISS → GitHub → Cache → Session
        self.draw_arrow(ax, 0.095, 0.78, 0.095, 0.66, "auto", "call")
        self.draw_arrow(ax, 0.165, 0.62, 0.215, 0.62, "auto")
        self.draw_arrow(ax, 0.355, 0.82, 0.405, 0.82, "auto")
        self.draw_arrow(ax, 0.565, 0.82, 0.625, 0.82, "loader", "git clone")
        self.draw_arrow(ax, 0.705, 0.78, 0.705, 0.66, "git")
        self.draw_arrow(ax, 0.625, 0.62, 0.565, 0.62, "loader", "cached")
        self.draw_arrow(ax, 0.405, 0.62, 0.355, 0.42, "auto")
        self.draw_arrow(ax, 0.215, 0.42, 0.165, 0.42, "auto")
        self.draw_arrow(ax, 0.095, 0.38, 0.095, 0.26, "auto", "result")

        # Flow ③: Publish
        self.draw_arrow(ax, 0.705, 0.18, 0.705, 0.26, "git", "tag + CI")
        self.draw_arrow(ax, 0.785, 0.42, 0.845, 0.72, "mcp", "sync")
        self.draw_arrow(ax, 0.485, 0.18, 0.405, 0.22, "auto", "invalidate")

        # Notion links
        self.draw_arrow(ax, 0.785, 0.62, 0.845, 0.52, "mcp", dashed=True)
        self.draw_arrow(ax, 0.785, 0.22, 0.845, 0.32, "mcp", dashed=True)


# ─── Main ─────────────────────────────────────────────────────────────────────

def render_all(output_dir: str = "/home/ubuntu/yos-components-registry"):
    """Génère les 3 schémas PNG du Components Registry."""
    out = Path(output_dir)

    print("\n[yOS Renderer v4] Generating Components Registry diagrams...\n")

    r1 = ComponentsInterrelationsRenderer()
    r1.render(str(out / "interrelations.png"))

    r2 = LifecycleRenderer()
    r2.render(str(out / "lifecycle.png"))

    r3 = GitLoaderRenderer()
    r3.render(str(out / "git-loader-arch.png"))

    print(f"\n[yOS Renderer v4] ✓ All 3 diagrams generated in {output_dir}")


if __name__ == "__main__":
    render_all()
