import os
import json
import datetime
import uuid
import threading
import math
from typing import List, Optional, Dict, Any

import requests
from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# --- Configuration ---
ARCHIVES_DIR = os.getenv("ARCHIVES_DIR", "/app/archives")
NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID", "31235e21-8cf8-8126-9212-f5a0eebadce0")
NOTION_API_KEY = os.getenv("NOTION_API_KEY")
YOS_API_KEY = os.getenv("YOS_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
NOTION_API_VERSION = "2022-06-28"
NOTION_BASE_URL = "https://api.notion.com/v1"
PUSH_MODEL = "gpt-4o-mini"
EMBED_MODEL = "text-embedding-3-small"
MMM_INDEX_FILE = os.getenv("MMM_INDEX_FILE", "/app/archives/mmm_index.json")

os.makedirs(ARCHIVES_DIR, exist_ok=True)

# ============================================================
# MMM — Multi-session/LLM Memory Manager
# Vector store léger : JSON + cosine similarity (no FAISS dep)
# ============================================================

_mmm_lock = threading.Lock()

def _load_mmm_index() -> List[Dict]:
    """Charge l'index MMM depuis le fichier JSON."""
    if not os.path.exists(MMM_INDEX_FILE):
        return []
    try:
        with open(MMM_INDEX_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def _save_mmm_index(index: List[Dict]) -> None:
    """Sauvegarde l'index MMM dans le fichier JSON."""
    with open(MMM_INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)

def _embed_text(text: str) -> Optional[List[float]]:
    """Génère un embedding OpenAI pour un texte."""
    if not OPENAI_API_KEY:
        return None
    try:
        resp = requests.post(
            f"{OPENAI_API_BASE}/embeddings",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            json={"model": EMBED_MODEL, "input": text[:8000]},
            timeout=15
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]
    except Exception as e:
        print(f"Embedding error: {e}")
        return None

def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calcule la similarité cosinus entre deux vecteurs."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

def _build_chunk_text(record: Dict) -> str:
    """Construit le texte à embedder depuis un record archivé."""
    parts = []
    title = record.get("title", "")
    if title:
        parts.append(f"Titre: {title}")
    insights = record.get("insights", {})
    if insights:
        summary = insights.get("summary", "")
        if summary:
            parts.append(f"Résumé: {summary}")
        for key in ["decisions", "canons", "insights", "entities", "todos"]:
            items = insights.get(key, [])
            if items:
                parts.append(f"{key.capitalize()}: " + " | ".join(str(i) for i in items[:5]))
    elif record.get("content_summary"):
        parts.append(f"Résumé: {record['content_summary']}")
    source = record.get("source", "")
    if source:
        parts.append(f"Source: {source}")
    return "\n".join(parts)

def mmm_index_record(record: Dict) -> bool:
    """Indexe un record archivé dans le MMM. Retourne True si succès."""
    archive_id = record.get("archive_id", str(uuid.uuid4()))
    chunk_text = _build_chunk_text(record)
    if not chunk_text.strip():
        return False
    embedding = _embed_text(chunk_text)
    if not embedding:
        return False
    entry = {
        "archive_id": archive_id,
        "title": record.get("title", ""),
        "source": record.get("source", ""),
        "archived_at": record.get("archived_at", ""),
        "notion_url": record.get("notion_page_url", ""),
        "chunk_text": chunk_text,
        "embedding": embedding,
    }
    with _mmm_lock:
        index = _load_mmm_index()
        # Remplacer si archive_id existe déjà
        index = [e for e in index if e.get("archive_id") != archive_id]
        index.append(entry)
        _save_mmm_index(index)
    print(f"MMM: indexed '{record.get('title', '')}' ({archive_id})")
    return True

def mmm_search(query: str, top_k: int = 3) -> List[Dict]:
    """Recherche sémantique dans l'index MMM. Retourne top_k résultats."""
    query_embedding = _embed_text(query)
    if not query_embedding:
        return []
    index = _load_mmm_index()
    if not index:
        return []
    scored = []
    for entry in index:
        emb = entry.get("embedding")
        if not emb:
            continue
        score = _cosine_similarity(query_embedding, emb)
        scored.append((score, entry))
    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for score, entry in scored[:top_k]:
        results.append({
            "archive_id": entry["archive_id"],
            "title": entry["title"],
            "source": entry["source"],
            "archived_at": entry["archived_at"],
            "notion_url": entry.get("notion_url", ""),
            "chunk_text": entry["chunk_text"],
            "score": round(score, 4),
        })
    return results

app = FastAPI(
    title="YOS Ingestion Endpoint + MMM",
    description="YOS Archiver v2.2 + MMM (Multi-session/LLM Memory Manager) — Archive, Push, RAG search, context injection.",
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not YOS_API_KEY:
        raise HTTPException(status_code=500, detail="YOS_API_KEY not configured on server.")
    if credentials.credentials != YOS_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return credentials.credentials

# --- Models ---
class ArchivePayload(BaseModel):
    title: str
    url: Optional[str] = None
    source: str  # ChatGPT | Claude | Gemini | Perplexity | Manus | Other
    action: str  # push | archive | push+archive
    content_full: Optional[str] = None
    content_summary: Optional[str] = None
    keywords: Optional[str] = None
    tags: List[str] = []
    turn_count: Optional[int] = None
    push_ref: Optional[str] = None
    archived_by: str = "Manus"

class ArchiveResponse(BaseModel):
    message: str
    archive_id: str
    notion_page_url: Optional[str] = None
    local_path: Optional[str] = None
    insights: Optional[Dict[str, Any]] = None

# --- OpenAI Push to YOS ---
PUSH_SYSTEM_PROMPT = """Tu es un extracteur d'insights cognitifs pour YOS (Yannick Operating System).
Analyse la conversation et extrais de façon structurée et concise :

1. decisions: liste des décisions prises (max 5)
2. canons: règles, principes ou conventions définies (max 5)
3. todos: actions à faire identifiées (max 5)
4. entities: entités nommées importantes — agents, projets, services, outils (max 10)
5. insights: insights clés, observations importantes (max 7)
6. summary: résumé dense de 80-100 mots

Réponds UNIQUEMENT en JSON valide avec ces 6 clés. Chaque valeur est une liste de strings sauf summary qui est une string."""

def extract_insights_openai(content: str, title: str) -> Optional[Dict[str, Any]]:
    """Appelle OpenAI pour extraire les insights structurés d'une conversation."""
    if not OPENAI_API_KEY:
        print("OPENAI_API_KEY not set — skipping Push to YOS extraction.")
        return None

    # Tronquer le contenu si trop long (max ~12000 tokens input)
    max_chars = 30000
    if len(content) > max_chars:
        content = content[:max_chars] + "\n\n[... contenu tronqué ...]"

    payload = {
        "model": PUSH_MODEL,
        "messages": [
            {"role": "system", "content": PUSH_SYSTEM_PROMPT},
            {"role": "user", "content": f"Titre de la conversation: {title}\n\n---\n\n{content}"}
        ],
        "temperature": 0.2,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"}
    }

    try:
        resp = requests.post(
            f"{OPENAI_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        raw = data["choices"][0]["message"]["content"]
        insights = json.loads(raw)
        print(f"Push to YOS: insights extraits pour '{title}'")
        return insights
    except Exception as e:
        print(f"OpenAI extraction error: {e}")
        return None

def format_insights_for_notion(insights: Dict[str, Any]) -> List[dict]:
    """Convertit les insights en blocs Notion."""
    blocks = []

    # Summary callout
    summary = insights.get("summary", "")
    if summary:
        blocks.append({
            "object": "block", "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": summary[:2000]}}],
                "icon": {"emoji": "💡"},
                "color": "blue_background"
            }
        })

    section_map = [
        ("decisions", "⚡ Décisions", "green_background"),
        ("canons", "📐 Canons & Règles", "purple_background"),
        ("todos", "✅ TODOs", "yellow_background"),
        ("entities", "🔗 Entités", "gray_background"),
        ("insights", "🧠 Insights", "blue_background"),
    ]

    for key, label, color in section_map:
        items = insights.get(key, [])
        if not items:
            continue
        blocks.append({
            "object": "block", "type": "heading_3",
            "heading_3": {"rich_text": [{"type": "text", "text": {"content": label}}]}
        })
        for item in items[:10]:
            blocks.append({
                "object": "block", "type": "bulleted_list_item",
                "bulleted_list_item": {
                    "rich_text": [{"type": "text", "text": {"content": str(item)[:2000]}}]
                }
            })

    return blocks

# --- Notion REST API helpers ---
def _notion_headers() -> dict:
    return {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_API_VERSION,
    }

def _chunk_text(text: str, size: int = 1900) -> List[str]:
    return [text[i:i+size] for i in range(0, len(text), size)]

def create_notion_page(item: ArchivePayload, insights: Optional[Dict] = None) -> Optional[str]:
    """Crée une page dans YOS Archives via REST API Notion."""
    if not NOTION_API_KEY:
        return None

    valid_sources = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Manus", "Other"]
    source = item.source if item.source in valid_sources else "Other"
    valid_actions = ["push", "archive", "push+archive"]
    action = item.action if item.action in valid_actions else "archive"

    # Résumé : priorité aux insights OpenAI, sinon content_summary fourni
    summary_text = ""
    if insights and insights.get("summary"):
        summary_text = insights["summary"]
    elif item.content_summary:
        summary_text = item.content_summary

    # Keywords : depuis insights entities + keywords fournis
    keywords_text = item.keywords or ""
    if insights and insights.get("entities"):
        entities_str = ", ".join(insights["entities"][:5])
        keywords_text = f"{keywords_text}, {entities_str}".strip(", ") if keywords_text else entities_str

    properties = {
        "Title": {"title": [{"text": {"content": item.title[:2000]}}]},
        "Source": {"select": {"name": source}},
        "Action": {"select": {"name": action}},
    }
    if item.url:
        properties["Source URL"] = {"url": item.url}
    if summary_text:
        properties["Summary"] = {"rich_text": [{"text": {"content": summary_text[:2000]}}]}
    if keywords_text:
        properties["Keywords"] = {"rich_text": [{"text": {"content": keywords_text[:2000]}}]}
    if item.turn_count is not None:
        properties["Turn Count"] = {"number": item.turn_count}
    if item.push_ref:
        properties["Push Ref"] = {"url": item.push_ref}
    if item.tags:
        valid_tags = ["yOS", "architecture", "security", "research", "design", "engineering"]
        filtered = [t for t in item.tags if t in valid_tags]
        if filtered:
            properties["Tags"] = {"multi_select": [{"name": t} for t in filtered]}

    # Blocs de contenu
    children = []

    if insights:
        children.extend(format_insights_for_notion(insights))
        children.append({"object": "block", "type": "divider", "divider": {}})

    if item.content_summary and not insights:
        children.append({
            "object": "block", "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": item.content_summary[:2000]}}],
                "icon": {"emoji": "💡"},
                "color": "blue_background"
            }
        })

    if item.content_full and action in ("archive", "push+archive"):
        children.append({
            "object": "block", "type": "heading_2",
            "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Verbatim"}}]}
        })
        for chunk in _chunk_text(item.content_full):
            children.append({
                "object": "block", "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": chunk}}]}
            })

    payload = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": properties,
        "children": children[:100],
    }

    try:
        resp = requests.post(
            f"{NOTION_BASE_URL}/pages",
            headers=_notion_headers(),
            json=payload,
            timeout=15
        )
        resp.raise_for_status()
        return resp.json().get("url", "")
    except requests.exceptions.HTTPError as e:
        print(f"Notion API error: {e.response.status_code} — {e.response.text[:200]}")
        return None
    except Exception as e:
        print(f"Notion error: {e}")
        return None

# --- Endpoints ---
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "2.2.0",
        "message": "YOS Archiver Endpoint is running",
        "notion": "configured" if NOTION_API_KEY else "not configured",
        "openai": "configured" if OPENAI_API_KEY else "not configured",
        "database_id": NOTION_DATABASE_ID
    }

@app.post("/api/archive", response_model=ArchiveResponse)
async def archive_conversation(item: ArchivePayload, background_tasks: BackgroundTasks, api_key: str = Depends(verify_api_key)):
    archive_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Extraction insights OpenAI si action = push ou push+archive
    insights = None
    if item.action in ("push", "push+archive") and item.content_full:
        insights = extract_insights_openai(item.content_full, item.title)

    # Stockage local (pour archive et push+archive)
    local_path = None
    if item.action in ("archive", "push+archive"):
        filename = os.path.join(ARCHIVES_DIR, f"{archive_id}.json")
        try:
            record = item.dict()
            record["archive_id"] = archive_id
            record["archived_at"] = now
            if insights:
                record["insights"] = insights
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(record, f, ensure_ascii=False, indent=2, default=str)
            local_path = filename
        except Exception as e:
            print(f"Local storage error: {e}")

    # Notion
    notion_page_url = create_notion_page(item, insights)

    # MMM indexation en arrière-plan
    record_for_mmm = item.dict()
    record_for_mmm["archive_id"] = archive_id
    record_for_mmm["archived_at"] = now
    record_for_mmm["notion_page_url"] = notion_page_url or ""
    if insights:
        record_for_mmm["insights"] = insights
    background_tasks.add_task(mmm_index_record, record_for_mmm)

    return ArchiveResponse(
        message=f"Action '{item.action}' completed for: {item.title}",
        archive_id=archive_id,
        notion_page_url=notion_page_url,
        local_path=local_path,
        insights=insights
    )

# --- MMM Routes ---

class MMMSearchRequest(BaseModel):
    query: str
    top_k: int = 3
    context_mode: bool = False  # Si True, formate pour injection dans prompt

@app.post("/api/mmm/search")
async def mmm_search_endpoint(req: MMMSearchRequest, api_key: str = Depends(verify_api_key)):
    """Recherche sémantique dans la mémoire YOS (MMM)."""
    results = mmm_search(req.query, req.top_k)
    if req.context_mode and results:
        # Formate pour injection directe dans un prompt LLM
        context_lines = ["=== Mémoire YOS — Contexte pertinent ==="]
        for i, r in enumerate(results, 1):
            context_lines.append(f"\n[{i}] {r['title']} ({r['source']}, {r['archived_at'][:10]})")
            context_lines.append(r['chunk_text'])
            if r.get('notion_url'):
                context_lines.append(f"→ {r['notion_url']}")
        context_lines.append("\n===================================")
        return {"context": "\n".join(context_lines), "results": results, "count": len(results)}
    return {"results": results, "count": len(results)}

@app.post("/api/mmm/index")
async def mmm_index_endpoint(background_tasks: BackgroundTasks, api_key: str = Depends(verify_api_key)):
    """Re-indexe toutes les archives locales dans le MMM."""
    files = [f for f in os.listdir(ARCHIVES_DIR) if f.endswith(".json") and f != "mmm_index.json"]
    if not files:
        return {"message": "No archives to index", "indexed": 0}
    def _reindex_all():
        count = 0
        for filename in files:
            filepath = os.path.join(ARCHIVES_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    record = json.load(f)
                if mmm_index_record(record):
                    count += 1
            except Exception as e:
                print(f"Reindex error for {filename}: {e}")
        print(f"MMM: re-indexed {count}/{len(files)} archives")
    background_tasks.add_task(_reindex_all)
    return {"message": f"Re-indexing {len(files)} archives in background", "total": len(files)}

@app.get("/api/mmm/stats")
async def mmm_stats(api_key: str = Depends(verify_api_key)):
    """Statistiques de l'index MMM."""
    index = _load_mmm_index()
    sources = {}
    for entry in index:
        s = entry.get("source", "Unknown")
        sources[s] = sources.get(s, 0) + 1
    return {
        "total_indexed": len(index),
        "sources": sources,
        "index_file": MMM_INDEX_FILE,
        "embed_model": EMBED_MODEL,
    }

@app.get("/api/archives", response_model=List[dict])
async def list_archives(api_key: str = Depends(verify_api_key)):
    archives = []
    try:
        for filename in sorted(os.listdir(ARCHIVES_DIR), reverse=True):
            if filename.endswith(".json"):
                filepath = os.path.join(ARCHIVES_DIR, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    archives.append({
                        "archive_id": data.get("archive_id", filename.replace(".json", "")),
                        "title": data.get("title", "Untitled"),
                        "source": data.get("source", "Unknown"),
                        "action": data.get("action", "archive"),
                        "archived_at": data.get("archived_at", ""),
                    })
                except Exception:
                    pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return archives


# --- Test Page (Gear Pro) ---
from fastapi.responses import HTMLResponse

@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """Page HTML de test YOS Hub pour Gear Pro — boutons cliquables gear://"""

    diag_js = "var d=document.createElement('div');d.style.cssText='position:fixed;bottom:20px;right:20px;background:#7c3aed;color:#fff;padding:12px 20px;border-radius:8px;font-family:system-ui;font-size:14px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(124,58,237,0.4)';d.textContent='\\u2705 YOS JS OK \\u2014 '+window.location.hostname;document.body.appendChild(d);setTimeout(function(){d.remove()},4000);"

    fab_js = "if(document.getElementById('yos-fab-test')){document.getElementById('yos-fab-test').remove();}var fab=document.createElement('div');fab.id='yos-fab-test';fab.style.cssText='position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;background:#7c3aed;color:#fff;font-size:20px;font-weight:700;display:flex;justify-content:center;align-items:center;cursor:pointer;z-index:99999;box-shadow:0 4px 12px rgba(124,58,237,0.5);font-family:system-ui';fab.textContent='Y';fab.title='YOS Hub Test v3.1';fab.onclick=function(){alert('YOS Hub actif sur '+window.location.hostname+'\\nURL: '+window.location.href);};document.body.appendChild(fab);console.log('[YOS] FAB inject\\u00e9 sur',window.location.hostname);"

    from urllib.parse import quote
    url1 = "gear://script?code=" + quote(diag_js)
    url2 = "gear://script?code=" + quote(fab_js)

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>YOS Hub — Test Gear Pro</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background: #0d0d0f;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    gap: 24px;
  }}
  .logo {{
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #7c3aed;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    box-shadow: 0 0 32px rgba(124,58,237,0.5);
  }}
  h1 {{
    font-size: 22px;
    font-weight: 700;
    color: #a78bfa;
    letter-spacing: -0.5px;
  }}
  p.sub {{
    font-size: 13px;
    color: #666;
    text-align: center;
    max-width: 300px;
    line-height: 1.5;
  }}
  .card {{
    background: #141418;
    border: 1px solid #2a2a35;
    border-radius: 16px;
    padding: 20px;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }}
  .card h2 {{
    font-size: 13px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  a.btn {{
    display: flex;
    align-items: center;
    gap: 12px;
    background: #1a1a22;
    border: 1px solid #2a2a35;
    border-radius: 12px;
    padding: 14px 16px;
    text-decoration: none;
    color: #ffffff;
    font-size: 15px;
    font-weight: 500;
    transition: all 0.15s ease;
    cursor: pointer;
  }}
  a.btn:active {{
    background: #7c3aed;
    border-color: #7c3aed;
    transform: scale(0.98);
  }}
  a.btn .icon {{
    font-size: 20px;
    width: 32px;
    text-align: center;
  }}
  a.btn .label {{ flex: 1; }}
  a.btn .desc {{
    font-size: 12px;
    color: #666;
    margin-top: 2px;
  }}
  a.btn-primary {{
    background: #4c1d95;
    border-color: #7c3aed;
  }}
  .divider {{
    height: 1px;
    background: #2a2a35;
    margin: 4px 0;
  }}
  .version {{
    font-size: 11px;
    color: #333;
    text-align: center;
  }}
</style>
</head>
<body>
  <div class="logo">Y</div>
  <h1>YOS Hub — Tests Gear Pro</h1>
  <p class="sub">Ouvre cette page dans Gear Pro sur manus.im, puis tape le lien dans la barre d'adresse.</p>

  <div class="card">
    <h2>Tests de base</h2>
    <a class="btn" href="{url1}">
      <span class="icon">🟣</span>
      <div class="label">
        Test 1 — Diagnostic JS
        <div class="desc">Toast violet 4s si JS actif</div>
      </div>
    </a>
    <a class="btn btn-primary" href="{url2}">
      <span class="icon">Y</span>
      <div class="label">
        Test 2 — FAB YOS minimal
        <div class="desc">Injecte le bouton Y cliquable</div>
      </div>
    </a>
  </div>

  <div class="card">
    <h2>Instructions</h2>
    <p style="font-size:13px;color:#888;line-height:1.6;">
      1. Navigue vers <strong style="color:#a78bfa">manus.im</strong> dans Gear Pro<br>
      2. Reviens sur cette page<br>
      3. Tape le lien du test dans la barre d'adresse<br>
      4. Le script s'exécute sur la page active
    </p>
  </div>

  <p class="version">YOS Archiver v3.1 — {datetime.datetime.utcnow().strftime('%Y-%m-%d')}</p>
</body>
</html>"""
    return html
