"""
viz-mermaid-themed — yOS Component v0.9.0
==========================================
Renderer Mermaid avec thème yOS canonique.
Utilise mermaid-cli (mmdc) pour le rendu SVG/PNG.

Interface:
    render(mermaid_code, theme='yos', output_format='svg', title='', width=1200)
    -> {'svg': str, 'png_path': str|None, 'error': str|None}

Tag: Manus | Projet: yOS Components Registry
"""

import subprocess
import tempfile
import os
from pathlib import Path
from typing import Optional

# Thème yOS pour mermaid-cli
YOS_THEME_CONFIG = {
    "theme": "dark",
    "themeVariables": {
        "primaryColor": "#1C3557",
        "primaryTextColor": "#FFFFFF",
        "primaryBorderColor": "#4A8EC2",
        "lineColor": "#4A8EC2",
        "secondaryColor": "#EDE7F6",
        "tertiaryColor": "#E3F5E8",
        "background": "#0F1923",
        "mainBkg": "#1C2A3A",
        "nodeBorder": "#4A8EC2",
        "clusterBkg": "#1A2535",
        "titleColor": "#FFFFFF",
        "edgeLabelBackground": "#1C3557",
        "fontFamily": "ui-monospace, monospace",
    }
}

YOS_LIGHT_THEME_CONFIG = {
    "theme": "default",
    "themeVariables": {
        "primaryColor": "#DFF0FB",
        "primaryTextColor": "#1C3557",
        "primaryBorderColor": "#4A8EC2",
        "lineColor": "#4A8EC2",
        "secondaryColor": "#EDE7F6",
        "tertiaryColor": "#E3F5E8",
        "background": "#FAFBFC",
        "mainBkg": "#DFF0FB",
        "nodeBorder": "#4A8EC2",
        "clusterBkg": "#E8EEF5",
        "titleColor": "#1C3557",
        "edgeLabelBackground": "#FFFFFF",
        "fontFamily": "ui-monospace, monospace",
    }
}


class MermaidThemedRenderer:
    """Renderer Mermaid avec thème yOS canonique."""

    COMPONENT_ID = "viz-mermaid-themed"
    VERSION = "0.9.0"
    LAYER = 2

    def __init__(self):
        self._check_mmdc()

    def _check_mmdc(self):
        """Vérifie si mermaid-cli est disponible."""
        try:
            result = subprocess.run(["mmdc", "--version"],
                                   capture_output=True, text=True, timeout=5)
            self._mmdc_available = result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            self._mmdc_available = False

    def render(
        self,
        mermaid_code: str,
        theme: str = "yos",
        output_format: str = "svg",
        title: str = "",
        width: int = 1200
    ) -> dict:
        """
        Rend un diagramme Mermaid avec le thème yOS.

        Args:
            mermaid_code: Code Mermaid valide
            theme: 'yos' | 'dark' | 'light' | 'default'
            output_format: 'svg' | 'png'
            title: Titre optionnel (header)
            width: Largeur PNG en pixels

        Returns:
            dict: {'svg': str, 'png_path': str|None, 'error': str|None}
        """
        if not self._mmdc_available:
            return {
                "svg": None,
                "png_path": None,
                "error": "mermaid-cli (mmdc) non disponible. Installer: npm install -g @mermaid-js/mermaid-cli"
            }

        import json

        # Sélectionner la config thème
        if theme in ("yos", "dark"):
            theme_config = YOS_THEME_CONFIG
        elif theme == "light":
            theme_config = YOS_LIGHT_THEME_CONFIG
        else:
            theme_config = {"theme": theme}

        with tempfile.TemporaryDirectory() as tmpdir:
            # Écrire le code Mermaid
            input_file = os.path.join(tmpdir, "diagram.mmd")
            with open(input_file, "w") as f:
                f.write(mermaid_code)

            # Écrire la config thème
            config_file = os.path.join(tmpdir, "config.json")
            with open(config_file, "w") as f:
                json.dump(theme_config, f)

            # Déterminer le fichier de sortie
            ext = output_format.lower()
            output_file = os.path.join(tmpdir, f"output.{ext}")

            # Exécuter mmdc
            cmd = [
                "mmdc",
                "-i", input_file,
                "-o", output_file,
                "-c", config_file,
                "-w", str(width),
                "--backgroundColor", "transparent"
            ]

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if result.returncode != 0:
                    return {"svg": None, "png_path": None,
                            "error": f"mmdc error: {result.stderr}"}

                if ext == "svg":
                    with open(output_file, "r") as f:
                        svg_content = f.read()
                    return {"svg": svg_content, "png_path": None, "error": None}
                else:
                    import shutil
                    png_dest = os.path.join(tempfile.gettempdir(),
                                           f"yos_mermaid_{hash(mermaid_code)}.png")
                    shutil.copy(output_file, png_dest)
                    return {"svg": None, "png_path": png_dest, "error": None}

            except subprocess.TimeoutExpired:
                return {"svg": None, "png_path": None,
                        "error": "Timeout: diagramme trop complexe (>30s)"}


# Singleton pour usage direct
_renderer = None

def render(mermaid_code: str, **kwargs) -> dict:
    """Fonction de convenance — render direct sans instanciation."""
    global _renderer
    if _renderer is None:
        _renderer = MermaidThemedRenderer()
    return _renderer.render(mermaid_code, **kwargs)
