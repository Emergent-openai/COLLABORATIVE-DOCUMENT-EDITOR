from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
documents_collection = db.documents
DEFAULT_DOCUMENT_ID = "shared-canvas"


PAGE_BLUEPRINTS = [
    {
        "id": "page-1",
        "title": "Opening Scene",
        "subtitle": "Frame the shared ambition with drama and clarity.",
        "accent": "#FF0080",
    },
    {
        "id": "page-2",
        "title": "Working Draft",
        "subtitle": "Shape the operating story with momentum.",
        "accent": "#7928CA",
    },
    {
        "id": "page-3",
        "title": "Launch Cut",
        "subtitle": "Land the next move and the publish-ready ending.",
        "accent": "#00CC99",
    },
]

AVATAR_URLS = [
    "https://images.unsplash.com/photo-1520529277867-dbf8c5e0b340?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1712168567852-ea607c2d3177?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1679466061812-211a6b737175?crop=entropy&cs=srgb&fm=jpg&q=85",
]

BLOCK_PLACEHOLDERS = {
    "heading": "Write a cinematic heading...",
    "paragraph": "Write the next beat of the document...",
    "quote": "Capture a memorable line...",
    "list": "List the next moves, one per line...",
    "divider": "Section divider",
}

ALLOWED_TEXT_STYLES = {"bold", "italic", "underline"}


def sanitize_page(raw: Dict[str, Any]) -> Dict[str, str]:
    return {
        "id": str(raw.get("id") or f"page-{uuid.uuid4()}")[:64],
        "title": str(raw.get("title") or "Untitled Page")[:100],
        "subtitle": str(raw.get("subtitle") or "")[:180],
        "accent": str(raw.get("accent") or "#000000")[:20],
    }


def sanitize_block(raw: Dict[str, Any]) -> Dict[str, Any]:
    block_type = str(raw.get("type") or "paragraph")
    if block_type not in BLOCK_PLACEHOLDERS:
        block_type = "paragraph"

    raw_styles = raw.get("styles") if isinstance(raw.get("styles"), list) else []
    styles: List[str] = []
    for style in raw_styles:
        normalized_style = str(style)
        if normalized_style in ALLOWED_TEXT_STYLES and normalized_style not in styles:
            styles.append(normalized_style)

    font_size_raw = raw.get("font_size")
    try:
        font_size = int(font_size_raw)
    except (TypeError, ValueError):
        font_size = 14
    font_size = max(12, min(24, font_size))

    return {
        "id": str(raw.get("id") or uuid.uuid4()),
        "page_id": str(raw.get("page_id") or PAGE_BLUEPRINTS[0]["id"]),
        "section": str(raw.get("section") or "Scene")[:80],
        "type": block_type,
        "content": str(raw.get("content") or ""),
        "annotation": str(raw.get("annotation") or ""),
        "placeholder": str(raw.get("placeholder") or BLOCK_PLACEHOLDERS[block_type]),
        "styles": styles,
        "font_family": str(raw.get("font_family") or "Inter")[:40],
        "font_size": font_size,
        "updated_at": str(raw.get("updated_at") or utc_now_iso()),
    }


def sanitize_comment(raw: Dict[str, Any]) -> Dict[str, str]:
    return {
        "id": str(raw.get("id") or uuid.uuid4()),
        "block_id": str(raw.get("block_id") or ""),
        "author_name": str(raw.get("author_name") or "Collaborator")[:80],
        "author_color": str(raw.get("author_color") or "#0070F3")[:20],
        "avatar_url": str(raw.get("avatar_url") or AVATAR_URLS[0]),
        "text": str(raw.get("text") or "")[:280],
        "created_at": str(raw.get("created_at") or utc_now_iso()),
    }


def sanitize_version(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(raw.get("id") or uuid.uuid4()),
        "label": str(raw.get("label") or "Snapshot")[:120],
        "reason": str(raw.get("reason") or "Live edit")[:160],
        "author": str(raw.get("author") or "System")[:80],
        "created_at": str(raw.get("created_at") or utc_now_iso()),
        "blocks": [sanitize_block(block) for block in raw.get("blocks", [])],
    }


def build_seed_blocks() -> List[Dict[str, str]]:
    now = utc_now_iso()
    return [
        {
            "id": "block-opening-heading",
            "page_id": "page-1",
            "section": "Opening Scene",
            "type": "heading",
            "content": "A shared document should feel alive the moment a second cursor lands.",
            "annotation": "Open with sensation before the product promise.",
            "placeholder": BLOCK_PLACEHOLDERS["heading"],
            "updated_at": now,
        },
        {
            "id": "block-opening-paragraph",
            "page_id": "page-1",
            "section": "Opening Scene",
            "type": "paragraph",
            "content": "We are designing a collaborative writing surface where every edit, suggestion, and glance carries presence. The page should feel tactile, cinematic, and unmistakably shared.",
            "annotation": "Keep the language close to product storytelling, not technical implementation.",
            "placeholder": BLOCK_PLACEHOLDERS["paragraph"],
            "updated_at": now,
        },
        {
            "id": "block-opening-quote",
            "page_id": "page-1",
            "section": "Opening Scene",
            "type": "quote",
            "content": "The best collaboration feels like everyone is writing in the same breath.",
            "annotation": "Maybe use this as the emotional anchor for the hero line.",
            "placeholder": BLOCK_PLACEHOLDERS["quote"],
            "updated_at": now,
        },
        {
            "id": "block-draft-heading",
            "page_id": "page-2",
            "section": "Working Draft",
            "type": "heading",
            "content": "Moments the editor must make visible",
            "annotation": "This section can become a feature list if the tone shifts from narrative to product.",
            "placeholder": BLOCK_PLACEHOLDERS["heading"],
            "updated_at": now,
        },
        {
            "id": "block-draft-paragraph",
            "page_id": "page-2",
            "section": "Working Draft",
            "type": "paragraph",
            "content": "Live cursors should glide instead of jump. Ghost text should hint at what collaborators are about to commit. Page turns, minimap indicators, and margin notes should all reinforce that the document is a dynamic stage, not a static page.",
            "annotation": "This is the operational spine of the document.",
            "placeholder": BLOCK_PLACEHOLDERS["paragraph"],
            "updated_at": now,
        },
        {
            "id": "block-draft-list",
            "page_id": "page-2",
            "section": "Working Draft",
            "type": "list",
            "content": "• Make collaborator presence impossible to miss\n• Keep the canvas soft, paper-like, and cinematic\n• Let version history feel like visual rewinding",
            "annotation": "Good candidate for a board review summary.",
            "placeholder": BLOCK_PLACEHOLDERS["list"],
            "updated_at": now,
        },
        {
            "id": "block-launch-heading",
            "page_id": "page-3",
            "section": "Launch Cut",
            "type": "heading",
            "content": "What happens when the story is ready to ship",
            "annotation": "This is where publish/share should feel celebratory.",
            "placeholder": BLOCK_PLACEHOLDERS["heading"],
            "updated_at": now,
        },
        {
            "id": "block-launch-paragraph",
            "page_id": "page-3",
            "section": "Launch Cut",
            "type": "paragraph",
            "content": "When the team shares the first polished version, the interface should reward that moment with calm confidence: a soft burst of confetti, a stable published view, and a clean handoff for anyone reading the final cut.",
            "annotation": "Potential place for a CTA if this becomes a landing page narrative.",
            "placeholder": BLOCK_PLACEHOLDERS["paragraph"],
            "updated_at": now,
        },
        {
            "id": "block-launch-divider",
            "page_id": "page-3",
            "section": "Launch Cut",
            "type": "divider",
            "content": "",
            "annotation": "Use the divider to pace the ending before the final callout.",
            "placeholder": BLOCK_PLACEHOLDERS["divider"],
            "updated_at": now,
        },
    ]


def build_seed_comments() -> List[Dict[str, str]]:
    now = utc_now_iso()
    return [
        {
            "id": "comment-opening-thread",
            "block_id": "block-opening-paragraph",
            "author_name": "Scene Director",
            "author_color": "#0070F3",
            "avatar_url": AVATAR_URLS[0],
            "text": "Could we heighten the tension in the first sentence before we explain the collaboration surface?",
            "created_at": now,
        },
        {
            "id": "comment-launch-thread",
            "block_id": "block-launch-paragraph",
            "author_name": "Release Lead",
            "author_color": "#FFB020",
            "avatar_url": AVATAR_URLS[1],
            "text": "I like the celebration. Let's keep it tasteful and brief instead of noisy.",
            "created_at": now,
        },
    ]


def build_version(label: str, reason: str, blocks: List[Dict[str, Any]], author: str) -> Dict[str, Any]:
    return sanitize_version(
        {
            "id": str(uuid.uuid4()),
            "label": label,
            "reason": reason,
            "author": author,
            "created_at": utc_now_iso(),
            "blocks": deepcopy(blocks),
        }
    )


def build_default_document() -> Dict[str, Any]:
    blocks = build_seed_blocks()
    return {
        "id": DEFAULT_DOCUMENT_ID,
        "title": "Collaborative Canvas",
        "subtitle": "A cinematic shared document where presence is part of the narrative.",
        "pages": [sanitize_page(page) for page in PAGE_BLUEPRINTS],
        "blocks": [sanitize_block(block) for block in blocks],
        "comments": [sanitize_comment(comment) for comment in build_seed_comments()],
        "versions": [build_version("Founding draft", "Initial seed", blocks, "System")],
        "published_snapshot": None,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
    }


def build_blank_document(document_id: str, title: str) -> Dict[str, Any]:
    pages = [sanitize_page(page) for page in PAGE_BLUEPRINTS]
    first_page = pages[0]
    blank_block = sanitize_block(
        {
            "id": str(uuid.uuid4()),
            "page_id": first_page["id"],
            "section": first_page["title"],
            "type": "paragraph",
            "content": "",
            "annotation": "",
            "placeholder": BLOCK_PLACEHOLDERS["paragraph"],
            "updated_at": utc_now_iso(),
        }
    )
    return {
        "id": document_id,
        "title": title,
        "subtitle": "A blank collaborative draft ready for the first sentence.",
        "pages": pages,
        "blocks": [blank_block],
        "comments": [],
        "versions": [build_version("Created document", "Blank document", [blank_block], "System")],
        "published_snapshot": None,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
    }


def build_document_summary(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(raw.get("id") or DEFAULT_DOCUMENT_ID),
        "title": str(raw.get("title") or "Untitled document")[:140],
        "created_at": str(raw.get("created_at") or utc_now_iso()),
        "updated_at": str(raw.get("updated_at") or utc_now_iso()),
        "is_published": bool(raw.get("published_snapshot")),
    }


def blocks_signature(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "id": block["id"],
            "page_id": block["page_id"],
            "type": block["type"],
            "content": block["content"],
            "annotation": block["annotation"],
            "styles": block.get("styles", []),
            "font_family": block.get("font_family", "Inter"),
            "font_size": block.get("font_size", 14),
        }
        for block in blocks
    ]


def append_version(document: Dict[str, Any], blocks: List[Dict[str, Any]], reason: str, author: str) -> None:
    current_signature = blocks_signature(blocks)
    previous_signature = (
        blocks_signature(document["versions"][-1]["blocks"])
        if document.get("versions")
        else []
    )
    if current_signature == previous_signature:
        return

    label = f"{reason[:36]} · {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
    document["versions"].append(build_version(label, reason, blocks, author))
    document["versions"] = document["versions"][-18:]


def sanitize_document(raw: Dict[str, Any]) -> Dict[str, Any]:
    pages = [sanitize_page(page) for page in raw.get("pages", PAGE_BLUEPRINTS)]
    blocks = [sanitize_block(block) for block in raw.get("blocks", build_seed_blocks())]
    comments = [sanitize_comment(comment) for comment in raw.get("comments", [])]
    versions = [sanitize_version(version) for version in raw.get("versions", [])][-18:]
    if not versions:
        versions = [build_version("Founding draft", "Initial seed", blocks, "System")]

    published_snapshot_raw = raw.get("published_snapshot")
    published_snapshot = sanitize_version(published_snapshot_raw) if published_snapshot_raw else None

    return {
        "id": str(raw.get("id") or "shared-canvas"),
        "title": str(raw.get("title") or "Collaborative Canvas")[:120],
        "subtitle": str(
            raw.get("subtitle")
            or "A cinematic shared document where presence is part of the narrative."
        )[:240],
        "pages": pages,
        "blocks": blocks,
        "comments": comments,
        "versions": versions,
        "published_snapshot": published_snapshot,
        "created_at": str(raw.get("created_at") or utc_now_iso()),
        "updated_at": str(raw.get("updated_at") or utc_now_iso()),
    }


class PageModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    subtitle: str
    accent: str


class BlockModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    page_id: str
    section: str
    type: str
    content: str
    annotation: str = ""
    placeholder: str = ""
    styles: List[str] = Field(default_factory=list)
    font_family: str = "Inter"
    font_size: int = 14
    updated_at: str


class CommentModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    block_id: str
    author_name: str
    author_color: str
    avatar_url: str
    text: str
    created_at: str


class VersionModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    label: str
    reason: str
    author: str
    created_at: str
    blocks: List[BlockModel]


class DocumentModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    subtitle: str
    pages: List[PageModel]
    blocks: List[BlockModel]
    comments: List[CommentModel]
    versions: List[VersionModel]
    published_snapshot: Optional[VersionModel] = None
    created_at: str
    updated_at: str


class CommentCreate(BaseModel):
    block_id: str
    author_name: str
    author_color: str
    avatar_url: str
    text: str = Field(min_length=1, max_length=280)


class AnnotationUpdate(BaseModel):
    block_id: str
    text: str = Field(default="", max_length=240)


class TitleUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=140)


class DocumentCreate(BaseModel):
    title: str = Field(default="Untitled document", max_length=140)


class PublishRequest(BaseModel):
    author_name: str = Field(default="Publisher", max_length=80)


class PublishResponse(BaseModel):
    first_publish: bool
    document: DocumentModel


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: Dict[str, Dict[str, WebSocket]] = defaultdict(dict)
        self.participants: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)
        self.typing_previews: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)

    async def connect(
        self,
        document_id: str,
        websocket: WebSocket,
        participant: Dict[str, Any],
    ) -> None:
        await websocket.accept()
        self.connections[document_id][participant["session_id"]] = websocket
        self.participants[document_id][participant["session_id"]] = participant

    def disconnect(self, document_id: str, session_id: str) -> None:
        self.connections[document_id].pop(session_id, None)
        self.participants[document_id].pop(session_id, None)
        self.clear_preview(document_id, session_id=session_id)
        if not self.connections[document_id]:
            self.connections.pop(document_id, None)
        if not self.participants[document_id]:
            self.participants.pop(document_id, None)
        if not self.typing_previews[document_id]:
            self.typing_previews.pop(document_id, None)

    async def send_personal(self, websocket: WebSocket, payload: Dict[str, Any]) -> None:
        await websocket.send_json(payload)

    async def broadcast(
        self,
        document_id: str,
        payload: Dict[str, Any],
        exclude_session_id: Optional[str] = None,
    ) -> None:
        stale_sessions: List[str] = []
        for session_id, socket in self.connections.get(document_id, {}).items():
            if exclude_session_id and session_id == exclude_session_id:
                continue
            try:
                await socket.send_json(payload)
            except Exception:
                stale_sessions.append(session_id)

        for session_id in stale_sessions:
            self.disconnect(document_id, session_id)

    def list_participants(self, document_id: str) -> List[Dict[str, Any]]:
        participants = list(self.participants.get(document_id, {}).values())
        return sorted(participants, key=lambda participant: participant["name"].lower())

    def list_typing_previews(self, document_id: str) -> List[Dict[str, Any]]:
        return list(self.typing_previews.get(document_id, {}).values())

    def clear_preview(
        self,
        document_id: str,
        block_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> None:
        previews = self.typing_previews.get(document_id, {})
        if block_id:
            previews.pop(block_id, None)
        if session_id:
            to_remove = [
                item_block_id
                for item_block_id, preview in previews.items()
                if preview.get("session_id") == session_id
            ]
            for item_block_id in to_remove:
                previews.pop(item_block_id, None)

        if not previews:
            self.typing_previews.pop(document_id, None)


manager = ConnectionManager()


async def get_or_create_document() -> Dict[str, Any]:
    existing_document = await documents_collection.find_one({"id": "shared-canvas"}, {"_id": 0})
    if existing_document:
        return sanitize_document(existing_document)

    default_document = build_default_document()
    await documents_collection.insert_one(deepcopy(default_document))
    return default_document


async def persist_document(document: Dict[str, Any]) -> Dict[str, Any]:
    clean_document = sanitize_document(document)
    await documents_collection.replace_one(
        {"id": clean_document["id"]},
        deepcopy(clean_document),
        upsert=True,
    )
    return clean_document


app = FastAPI()
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root() -> Dict[str, str]:
    return {"message": "Collaborative Canvas API is live."}


@api_router.get("/document", response_model=DocumentModel)
async def get_document() -> Dict[str, Any]:
    return await get_or_create_document()


@api_router.post("/document", response_model=DocumentModel)
async def create_document(payload: Optional[DocumentCreate] = None) -> Dict[str, Any]:
    current_document = await get_or_create_document()
    requested_title = (payload.title if payload else "Untitled document").strip()
    next_title = requested_title or "Untitled document"

    fresh_document = build_blank_document(current_document["id"], next_title)
    saved_document = await persist_document(fresh_document)

    manager.typing_previews.pop(saved_document["id"], None)
    first_page_id = saved_document["pages"][0]["id"] if saved_document.get("pages") else ""
    first_block_id = saved_document["blocks"][0]["id"] if saved_document.get("blocks") else ""
    for participant in manager.participants.get(saved_document["id"], {}).values():
        participant["active_page"] = first_page_id
        participant["active_block_id"] = first_block_id
        participant["is_typing"] = False
        participant["position_ratio"] = 0.08

    await manager.broadcast(
        saved_document["id"],
        {
            "type": "document_sync",
            "document": saved_document,
            "participants": manager.list_participants(saved_document["id"]),
            "typing_previews": manager.list_typing_previews(saved_document["id"]),
        },
    )
    return saved_document


@api_router.get("/document/published", response_model=VersionModel)
async def get_published_document() -> Dict[str, Any]:
    document = await get_or_create_document()
    published_snapshot = document.get("published_snapshot")
    if not published_snapshot:
        raise HTTPException(status_code=404, detail="Document has not been published yet.")
    return published_snapshot


@api_router.post("/document/comments", response_model=DocumentModel)
async def add_comment(payload: CommentCreate) -> Dict[str, Any]:
    document = await get_or_create_document()

    matching_block = next(
        (block for block in document["blocks"] if block["id"] == payload.block_id),
        None,
    )
    if not matching_block:
        raise HTTPException(status_code=404, detail="Target block not found.")

    document["comments"].append(
        sanitize_comment(
            {
                "id": str(uuid.uuid4()),
                "block_id": payload.block_id,
                "author_name": payload.author_name,
                "author_color": payload.author_color,
                "avatar_url": payload.avatar_url,
                "text": payload.text,
                "created_at": utc_now_iso(),
            }
        )
    )
    document["updated_at"] = utc_now_iso()

    saved_document = await persist_document(document)
    await manager.broadcast(document["id"], {"type": "document_sync", "document": saved_document})
    return saved_document


@api_router.post("/document/annotations", response_model=DocumentModel)
async def update_annotation(payload: AnnotationUpdate) -> Dict[str, Any]:
    document = await get_or_create_document()
    block_found = False

    for block in document["blocks"]:
        if block["id"] == payload.block_id:
            block["annotation"] = payload.text
            block["updated_at"] = utc_now_iso()
            block_found = True
            break

    if not block_found:
        raise HTTPException(status_code=404, detail="Target block not found.")

    document["updated_at"] = utc_now_iso()
    append_version(document, document["blocks"], "Margin note updated", "Annotations")

    saved_document = await persist_document(document)
    await manager.broadcast(document["id"], {"type": "document_sync", "document": saved_document})
    return saved_document


@api_router.post("/document/title", response_model=DocumentModel)
async def update_document_title(payload: TitleUpdate) -> Dict[str, Any]:
    document = await get_or_create_document()
    next_title = payload.title.strip()
    if not next_title:
        raise HTTPException(status_code=400, detail="Document title cannot be empty.")

    document["title"] = next_title
    document["updated_at"] = utc_now_iso()

    saved_document = await persist_document(document)
    await manager.broadcast(document["id"], {"type": "document_sync", "document": saved_document})
    return saved_document


@api_router.delete("/document/block/{block_id}", response_model=DocumentModel)
async def delete_document_block(block_id: str) -> Dict[str, Any]:
    document = await get_or_create_document()
    existing_blocks = document.get("blocks", [])
    target_block = next((block for block in existing_blocks if block["id"] == block_id), None)
    if not target_block:
        raise HTTPException(status_code=404, detail="Target block not found.")

    next_blocks = [block for block in existing_blocks if block["id"] != block_id]
    if not next_blocks:
        first_page = document["pages"][0] if document.get("pages") else sanitize_page(PAGE_BLUEPRINTS[0])
        if not document.get("pages"):
            document["pages"] = [first_page]
        next_blocks = [
            sanitize_block(
                {
                    "id": str(uuid.uuid4()),
                    "page_id": first_page["id"],
                    "section": first_page["title"],
                    "type": "paragraph",
                    "content": "",
                    "annotation": "",
                    "placeholder": BLOCK_PLACEHOLDERS["paragraph"],
                    "updated_at": utc_now_iso(),
                }
            )
        ]

    document["blocks"] = next_blocks
    document["comments"] = [
        comment for comment in document.get("comments", []) if comment.get("block_id") != block_id
    ]
    document["updated_at"] = utc_now_iso()
    append_version(document, next_blocks, "Deleted block", "Editor")

    manager.clear_preview(document["id"], block_id=block_id)
    fallback_block = next_blocks[0]
    for participant in manager.participants.get(document["id"], {}).values():
        if participant.get("active_block_id") == block_id:
            participant["active_block_id"] = fallback_block["id"]
            participant["active_page"] = fallback_block["page_id"]
            participant["is_typing"] = False

    saved_document = await persist_document(document)
    await manager.broadcast(
        document["id"],
        {
            "type": "document_sync",
            "document": saved_document,
            "participants": manager.list_participants(document["id"]),
            "typing_previews": manager.list_typing_previews(document["id"]),
        },
    )
    return saved_document


@api_router.post("/document/publish", response_model=PublishResponse)
async def publish_document(payload: PublishRequest) -> PublishResponse:
    document = await get_or_create_document()
    first_publish = document.get("published_snapshot") is None
    document["published_snapshot"] = build_version(
        "Published cut",
        "Published snapshot",
        document["blocks"],
        payload.author_name,
    )
    document["updated_at"] = utc_now_iso()

    saved_document = await persist_document(document)
    await manager.broadcast(document["id"], {"type": "document_sync", "document": saved_document})
    return PublishResponse(first_publish=first_publish, document=saved_document)


@api_router.post("/document/restore/{version_id}", response_model=DocumentModel)
async def restore_document_version(version_id: str) -> Dict[str, Any]:
    document = await get_or_create_document()
    target_version = next(
        (version for version in document["versions"] if version["id"] == version_id),
        None,
    )
    if not target_version:
        raise HTTPException(status_code=404, detail="Version not found.")

    document["blocks"] = [sanitize_block(block) for block in deepcopy(target_version["blocks"])]
    document["updated_at"] = utc_now_iso()
    append_version(
        document,
        document["blocks"],
        f"Restored {target_version['label']}",
        "Timeline",
    )

    saved_document = await persist_document(document)
    await manager.broadcast(document["id"], {"type": "document_sync", "document": saved_document})
    return saved_document


@app.websocket("/api/ws/document")
async def collaborative_document_socket(websocket: WebSocket) -> None:
    document = await get_or_create_document()
    document_id = document["id"]
    session_id = websocket.query_params.get("session_id") or str(uuid.uuid4())
    default_page = document["pages"][0]["id"]

    participant = {
        "session_id": session_id,
        "name": str(websocket.query_params.get("name") or "Guest Writer")[:80],
        "color": str(websocket.query_params.get("color") or "#0070F3")[:20],
        "avatar_url": str(websocket.query_params.get("avatar_url") or AVATAR_URLS[0]),
        "cursor": {"x": 120, "y": 160},
        "active_page": str(websocket.query_params.get("page_id") or default_page),
        "position_ratio": 0.12,
        "active_block_id": "",
        "is_typing": False,
        "joined_at": utc_now_iso(),
    }

    await manager.connect(document_id, websocket, participant)
    await manager.send_personal(
        websocket,
        {
            "type": "snapshot",
            "document": document,
            "participants": manager.list_participants(document_id),
            "typing_previews": manager.list_typing_previews(document_id),
            "session_id": session_id,
        },
    )
    await manager.broadcast(
        document_id,
        {"type": "presence_sync", "participants": manager.list_participants(document_id)},
        exclude_session_id=session_id,
    )

    try:
        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type")
            current_participant = manager.participants[document_id].get(session_id)

            if event_type == "cursor_move" and current_participant:
                current_participant["cursor"] = {
                    "x": float(payload.get("x", current_participant["cursor"]["x"])),
                    "y": float(payload.get("y", current_participant["cursor"]["y"])),
                }
                current_participant["active_page"] = str(
                    payload.get("active_page") or current_participant["active_page"]
                )
                current_participant["position_ratio"] = max(
                    0.0,
                    min(1.0, float(payload.get("position_ratio", current_participant["position_ratio"]))),
                )
                current_participant["active_block_id"] = str(
                    payload.get("active_block_id") or current_participant.get("active_block_id") or ""
                )
                if payload.get("is_typing") is not None:
                    current_participant["is_typing"] = bool(payload.get("is_typing"))

                await manager.broadcast(
                    document_id,
                    {"type": "presence_sync", "participants": manager.list_participants(document_id)},
                )

            elif event_type == "typing_preview" and current_participant:
                preview_content = str(payload.get("content") or "")
                block_id = str(payload.get("block_id") or "")
                page_id = str(payload.get("page_id") or current_participant["active_page"])
                if block_id and preview_content.strip():
                    manager.typing_previews[document_id][block_id] = {
                        "session_id": session_id,
                        "block_id": block_id,
                        "page_id": page_id,
                        "content": preview_content,
                        "name": current_participant["name"],
                        "color": current_participant["color"],
                        "avatar_url": current_participant["avatar_url"],
                        "updated_at": utc_now_iso(),
                    }
                else:
                    manager.clear_preview(document_id, block_id=block_id, session_id=session_id)

                current_participant["is_typing"] = bool(preview_content.strip())
                current_participant["active_block_id"] = block_id
                current_participant["active_page"] = page_id

                await manager.broadcast(
                    document_id,
                    {
                        "type": "typing_sync",
                        "typing_previews": manager.list_typing_previews(document_id),
                        "participants": manager.list_participants(document_id),
                    },
                )

            elif event_type == "blocks_replace":
                live_document = await get_or_create_document()
                next_blocks = [sanitize_block(block) for block in payload.get("blocks", live_document["blocks"])]
                live_document["blocks"] = next_blocks
                live_document["updated_at"] = utc_now_iso()
                append_version(
                    live_document,
                    next_blocks,
                    str(payload.get("reason") or "Live edit"),
                    str(payload.get("author") or participant["name"]),
                )

                manager.clear_preview(document_id, session_id=session_id)
                if current_participant:
                    current_participant["is_typing"] = False

                saved_document = await persist_document(live_document)
                await manager.broadcast(
                    document_id,
                    {
                        "type": "document_sync",
                        "document": saved_document,
                        "participants": manager.list_participants(document_id),
                        "typing_previews": manager.list_typing_previews(document_id),
                    },
                )

    except WebSocketDisconnect:
        manager.disconnect(document_id, session_id)
        await manager.broadcast(
            document_id,
            {
                "type": "presence_sync",
                "participants": manager.list_participants(document_id),
            },
        )
        await manager.broadcast(
            document_id,
            {
                "type": "typing_sync",
                "typing_previews": manager.list_typing_previews(document_id),
                "participants": manager.list_participants(document_id),
            },
        )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()