"""
yOS Component Loader — v1.0.0
==============================
Utilitaire de chargement des composants yOS depuis GitHub avec cache local.

Usage:
    from yos_loader import load_component, list_components, registry_status

    # Charger un composant
    mermaid = load_component("viz-mermaid-themed")
    result = mermaid.render(code="graph TD; A-->B", theme="dark")

    # Lister les composants disponibles
    components = list_components(status="stable")

    # Statut du registry
    registry_status()

Tag: Manus | Projet: yOS Components Registry
"""

import json
import subprocess
import sys
import importlib.util
import time
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Any

# ─── Configuration ────────────────────────────────────────────────────────────

YOS_CACHE_DIR = Path("/tmp/yos-components")
YOS_REPO = "https://github.com/yannick/yos-components"
YOS_REGISTRY_URL = f"{YOS_REPO}/raw/main/registry.json"
CACHE_TTL_HOURS = 24
REGISTRY_CACHE_FILE = YOS_CACHE_DIR / "_registry.json"
REGISTRY_CACHE_TTL_HOURS = 6


# ─── Registry ─────────────────────────────────────────────────────────────────

def _load_registry(force_refresh: bool = False) -> dict:
    """Charge le registry depuis cache local ou GitHub."""
    if not force_refresh and REGISTRY_CACHE_FILE.exists():
        age = time.time() - REGISTRY_CACHE_FILE.stat().st_mtime
        if age < REGISTRY_CACHE_TTL_HOURS * 3600:
            with open(REGISTRY_CACHE_FILE) as f:
                return json.load(f)

    try:
        result = subprocess.run(
            ["curl", "-s", "-L", YOS_REGISTRY_URL],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            registry = json.loads(result.stdout)
            YOS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(REGISTRY_CACHE_FILE, "w") as f:
                json.dump(registry, f, indent=2)
            return registry
    except Exception as e:
        print(f"[yOS Loader] Warning: Could not fetch remote registry: {e}")

    # Fallback: local registry if exists
    local_registry = Path(__file__).parent / "registry.json"
    if local_registry.exists():
        with open(local_registry) as f:
            return json.load(f)

    return {"components": []}


def list_components(
    category: Optional[str] = None,
    status: Optional[str] = None,
    layer: Optional[int] = None,
    priority: Optional[str] = None
) -> list[dict]:
    """
    Liste les composants disponibles dans le registry.

    Args:
        category: Filtrer par catégorie (VIZ, NAV, SEL, DAT, COG, INT, SYS)
        status: Filtrer par statut (draft, beta, stable, deprecated)
        layer: Filtrer par layer (1, 2, 3, 4)
        priority: Filtrer par priorité (P0, P1, P2, P3)

    Returns:
        Liste de dicts composants
    """
    registry = _load_registry()
    components = registry.get("components", [])

    if category:
        components = [c for c in components if c.get("category") == category.upper()]
    if status:
        components = [c for c in components if c.get("status") == status.lower()]
    if layer is not None:
        components = [c for c in components if c.get("layer") == layer]
    if priority:
        components = [c for c in components if c.get("priority") == priority.upper()]

    return components


def registry_status() -> None:
    """Affiche un résumé du registry dans la console."""
    registry = _load_registry()
    components = registry.get("components", [])
    meta = registry.get("_meta", {})

    print(f"\n{'='*60}")
    print(f"  yOS Components Registry — v{meta.get('registry_version', '?')}")
    print(f"  Last updated: {meta.get('last_updated', '?')}")
    print(f"{'='*60}")

    by_status = {}
    for c in components:
        s = c.get("status", "unknown")
        by_status.setdefault(s, []).append(c["id"])

    for status, ids in sorted(by_status.items()):
        print(f"\n  [{status.upper()}] ({len(ids)})")
        for cid in ids:
            comp = next(c for c in components if c["id"] == cid)
            print(f"    • {cid} v{comp.get('version', '?')} — {comp.get('name', '?')}")

    print(f"\n  Total: {len(components)} composants\n")


# ─── Loader ───────────────────────────────────────────────────────────────────

def _get_cache_path(component_id: str) -> Path:
    return YOS_CACHE_DIR / component_id


def _is_cache_valid(cache_path: Path, ttl_hours: int = CACHE_TTL_HOURS) -> bool:
    if not cache_path.exists():
        return False
    age = time.time() - cache_path.stat().st_mtime
    return age < ttl_hours * 3600


def _clone_component(component_id: str, component_info: dict) -> Path:
    """Clone le composant depuis GitHub avec sparse checkout."""
    cache_path = _get_cache_path(component_id)
    sparse_path = component_info.get("path", f"components/{component_id.replace('-', '/', 1)}/")

    print(f"[yOS Loader] Fetching {component_id} from GitHub...")

    YOS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    if cache_path.exists():
        # Update existing
        result = subprocess.run(
            ["git", "-C", str(cache_path), "pull", "--quiet"],
            capture_output=True, text=True
        )
    else:
        # Fresh clone with sparse checkout
        subprocess.run([
            "git", "clone", "--depth", "1",
            "--filter=blob:none", "--sparse",
            YOS_REPO, str(cache_path)
        ], check=True, capture_output=True)

        subprocess.run([
            "git", "-C", str(cache_path),
            "sparse-checkout", "set", sparse_path
        ], check=True, capture_output=True)

    print(f"[yOS Loader] ✓ {component_id} ready at {cache_path}")
    return cache_path


def _find_entry_point(cache_path: Path, component_info: dict) -> Path:
    """Trouve le point d'entrée du composant."""
    entry_relative = component_info.get("entry", "")
    if entry_relative:
        # Extract just the filename from the path
        entry_name = Path(entry_relative).name
        matches = list(cache_path.rglob(entry_name))
        if matches:
            return matches[0]

    # Fallback: search for index.{ext}
    for ext in ["py", "js", "sh"]:
        matches = list(cache_path.rglob(f"index.{ext}"))
        if matches:
            return matches[0]

    raise FileNotFoundError(
        f"[yOS Loader] No entry point found for component in {cache_path}"
    )


def _import_python_module(entry: Path, component_id: str) -> Any:
    """Importe un module Python depuis un chemin."""
    spec = importlib.util.spec_from_file_location(
        f"yos_component_{component_id.replace('-', '_')}",
        entry
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_component(
    component_id: str,
    version: str = "latest",
    force_refresh: bool = False,
    ttl_hours: int = CACHE_TTL_HOURS
) -> Any:
    """
    Charge un composant yOS depuis le cache local ou GitHub.

    Args:
        component_id: ID du composant (ex: "viz-mermaid-themed")
        version: Version à charger ("latest" ou "MAJOR.MINOR.PATCH")
        force_refresh: Forcer le re-téléchargement même si cache valide
        ttl_hours: Durée de validité du cache en heures

    Returns:
        Module Python du composant

    Raises:
        ValueError: Si le composant n'existe pas dans le registry
        FileNotFoundError: Si le point d'entrée n'est pas trouvé
    """
    # Lookup in registry
    registry = _load_registry()
    components = {c["id"]: c for c in registry.get("components", [])}

    if component_id not in components:
        available = ", ".join(components.keys())
        raise ValueError(
            f"[yOS Loader] Component '{component_id}' not found in registry.\n"
            f"Available: {available}"
        )

    component_info = components[component_id]
    cache_path = _get_cache_path(component_id)

    # Check cache
    if not force_refresh and _is_cache_valid(cache_path, ttl_hours):
        print(f"[yOS Loader] Cache hit: {component_id} v{component_info.get('version', '?')}")
    else:
        cache_path = _clone_component(component_id, component_info)

    # Find and load entry point
    entry = _find_entry_point(cache_path, component_info)

    if entry.suffix == ".py":
        return _import_python_module(entry, component_id)
    else:
        # For non-Python components, return path info
        return {"entry": str(entry), "info": component_info}


def invalidate_cache(component_id: Optional[str] = None) -> None:
    """
    Invalide le cache d'un composant ou de tous les composants.

    Args:
        component_id: ID du composant à invalider, ou None pour tout invalider
    """
    if component_id:
        cache_path = _get_cache_path(component_id)
        if cache_path.exists():
            import shutil
            shutil.rmtree(cache_path)
            print(f"[yOS Loader] Cache invalidated: {component_id}")
        else:
            print(f"[yOS Loader] No cache found for: {component_id}")
    else:
        if YOS_CACHE_DIR.exists():
            import shutil
            shutil.rmtree(YOS_CACHE_DIR)
            print(f"[yOS Loader] All caches invalidated")


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="yOS Component Loader CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python yos_loader.py status
  python yos_loader.py list --status stable
  python yos_loader.py load viz-mermaid-themed
  python yos_loader.py invalidate viz-mermaid-themed
        """
    )

    subparsers = parser.add_subparsers(dest="command")

    # status
    subparsers.add_parser("status", help="Show registry status")

    # list
    list_parser = subparsers.add_parser("list", help="List components")
    list_parser.add_argument("--category", help="Filter by category")
    list_parser.add_argument("--status", help="Filter by status")
    list_parser.add_argument("--layer", type=int, help="Filter by layer")

    # load
    load_parser = subparsers.add_parser("load", help="Load a component")
    load_parser.add_argument("component_id", help="Component ID")
    load_parser.add_argument("--version", default="latest")
    load_parser.add_argument("--force", action="store_true")

    # invalidate
    inv_parser = subparsers.add_parser("invalidate", help="Invalidate cache")
    inv_parser.add_argument("component_id", nargs="?", help="Component ID (omit for all)")

    args = parser.parse_args()

    if args.command == "status":
        registry_status()

    elif args.command == "list":
        comps = list_components(
            category=getattr(args, "category", None),
            status=getattr(args, "status", None),
            layer=getattr(args, "layer", None)
        )
        print(f"\n{'ID':<30} {'Name':<35} {'Cat':<5} {'L':<3} {'Ver':<10} {'Status'}")
        print("-" * 95)
        for c in comps:
            print(f"{c['id']:<30} {c['name']:<35} {c['category']:<5} {c['layer']:<3} {c.get('version','?'):<10} {c['status']}")

    elif args.command == "load":
        try:
            module = load_component(
                args.component_id,
                version=args.version,
                force_refresh=args.force
            )
            print(f"[yOS Loader] ✓ Component loaded: {args.component_id}")
        except Exception as e:
            print(f"[yOS Loader] ✗ Error: {e}")
            sys.exit(1)

    elif args.command == "invalidate":
        invalidate_cache(getattr(args, "component_id", None))

    else:
        parser.print_help()
