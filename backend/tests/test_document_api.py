"""
Backend API tests for Collaborative Document Editor MVP.
Tests cover: document CRUD, new document creation, block deletion,
formatting (styles, font_family, font_size), comments, annotations,
publish, restore, and WebSocket snapshot.
"""

import os
import uuid
from urllib.parse import urlencode

import pytest
import requests


BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API_BASE = f"{BASE_URL}/api"


def _ws_url() -> str:
    if BASE_URL.startswith("https://"):
        base = BASE_URL.replace("https://", "wss://", 1)
    elif BASE_URL.startswith("http://"):
        base = BASE_URL.replace("http://", "ws://", 1)
    else:
        raise RuntimeError("REACT_APP_BACKEND_URL must start with http:// or https://")
    return f"{base}/api/ws/document"


@pytest.fixture(scope="session")
def api_client():
    """Shared HTTP session for document API regression coverage."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def initial_document(api_client):
    """Seed document snapshot used by API and UI integration tests."""
    response = api_client.get(f"{API_BASE}/document", timeout=20)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "shared-canvas"
    return data


# ==================== NEW DOCUMENT CREATION TESTS ====================
class TestNewDocumentEndpoint:
    """Tests for POST /api/document - creating a fresh blank document."""

    def test_create_new_document_default_title(self, api_client):
        """POST /api/document without payload creates a document with default title."""
        response = api_client.post(f"{API_BASE}/document", timeout=20)
        assert response.status_code == 200
        
        data = response.json()
        # Verify document structure
        assert data["id"] == "shared-canvas"  # Same doc ID (replaces existing)
        assert data["title"] == "Untitled document"
        assert isinstance(data["pages"], list) and len(data["pages"]) == 3
        assert isinstance(data["blocks"], list) and len(data["blocks"]) == 1
        
        # Verify the single blank block
        first_block = data["blocks"][0]
        assert first_block["type"] == "paragraph"
        assert first_block["content"] == ""
        assert first_block["page_id"] == data["pages"][0]["id"]
        
        # Verify empty comments and fresh version history
        assert data["comments"] == []
        assert len(data["versions"]) == 1
        assert data["versions"][0]["label"] == "Created document"
        
    def test_create_new_document_with_custom_title(self, api_client):
        """POST /api/document with title payload sets custom title."""
        custom_title = f"TEST_Doc_{uuid.uuid4().hex[:8]}"
        response = api_client.post(
            f"{API_BASE}/document",
            json={"title": custom_title},
            timeout=20
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == custom_title
        assert len(data["blocks"]) == 1
        assert data["blocks"][0]["content"] == ""
        
        # Verify persistence via GET
        get_response = api_client.get(f"{API_BASE}/document", timeout=20)
        assert get_response.status_code == 200
        persisted = get_response.json()
        assert persisted["title"] == custom_title


# ==================== DELETE BLOCK TESTS ====================
class TestDeleteBlockEndpoint:
    """Tests for DELETE /api/document/block/{block_id} - deleting blocks."""

    def test_delete_block_success(self, api_client):
        """DELETE /api/document/block/{block_id} removes the block and returns updated doc."""
        # First create a new document to have clean state
        api_client.post(f"{API_BASE}/document", json={"title": "TEST Delete Block Doc"}, timeout=20)
        
        # Add a second block via annotation (which triggers block creation) - we'll use existing block instead
        doc_response = api_client.get(f"{API_BASE}/document", timeout=20)
        doc = doc_response.json()
        
        # Store the initial block ID
        initial_block_id = doc["blocks"][0]["id"]
        
        # Delete the only block - should create a replacement blank block
        delete_response = api_client.delete(
            f"{API_BASE}/document/block/{initial_block_id}",
            timeout=20
        )
        assert delete_response.status_code == 200
        
        deleted_doc = delete_response.json()
        # When last block is deleted, a new blank block is created
        assert len(deleted_doc["blocks"]) == 1
        assert deleted_doc["blocks"][0]["id"] != initial_block_id
        assert deleted_doc["blocks"][0]["type"] == "paragraph"
        assert deleted_doc["blocks"][0]["content"] == ""

    def test_delete_block_not_found(self, api_client):
        """DELETE /api/document/block/{nonexistent_id} returns 404."""
        fake_block_id = f"nonexistent-block-{uuid.uuid4().hex[:8]}"
        response = api_client.delete(
            f"{API_BASE}/document/block/{fake_block_id}",
            timeout=20
        )
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()

    def test_delete_block_removes_associated_comments(self, api_client):
        """Deleting a block also removes its associated comments."""
        # Create fresh document
        api_client.post(f"{API_BASE}/document", json={"title": "TEST Delete Comments"}, timeout=20)
        
        doc = api_client.get(f"{API_BASE}/document", timeout=20).json()
        block_id = doc["blocks"][0]["id"]
        
        # Add a comment to this block
        comment_text = f"TEST_comment_to_delete_{uuid.uuid4().hex[:8]}"
        api_client.post(
            f"{API_BASE}/document/comments",
            json={
                "block_id": block_id,
                "author_name": "TEST_User",
                "author_color": "#FF0080",
                "avatar_url": "https://example.com/avatar.jpg",
                "text": comment_text
            },
            timeout=20
        )
        
        # Verify comment was added
        doc_with_comment = api_client.get(f"{API_BASE}/document", timeout=20).json()
        assert any(c["text"] == comment_text for c in doc_with_comment["comments"])
        
        # Delete the block
        delete_response = api_client.delete(f"{API_BASE}/document/block/{block_id}", timeout=20)
        assert delete_response.status_code == 200
        
        # Verify comment was removed
        deleted_doc = delete_response.json()
        assert not any(c["text"] == comment_text for c in deleted_doc["comments"])


# ==================== FORMATTING/STYLES TESTS ====================
class TestBlockFormattingPersistence:
    """Tests for block styles (bold/italic/underline), font_family, and font_size persistence."""

    def test_block_styles_persist_in_document(self, api_client):
        """Verify that block styles (bold, italic, underline) are sanitized and returned."""
        # Get current document
        doc = api_client.get(f"{API_BASE}/document", timeout=20).json()
        
        # The sanitize_block function should accept and return valid styles
        # Since blocks_replace is via WebSocket, we verify the GET returns style fields
        for block in doc["blocks"]:
            assert "styles" in block
            assert isinstance(block["styles"], list)
            # Verify only allowed styles are present
            for style in block["styles"]:
                assert style in ["bold", "italic", "underline"]

    def test_block_font_family_and_size_present(self, api_client):
        """Verify font_family and font_size fields are present and have valid defaults."""
        doc = api_client.get(f"{API_BASE}/document", timeout=20).json()
        
        for block in doc["blocks"]:
            assert "font_family" in block
            assert isinstance(block["font_family"], str)
            assert len(block["font_family"]) <= 40
            
            assert "font_size" in block
            assert isinstance(block["font_size"], int)
            assert 12 <= block["font_size"] <= 24


class TestDocumentApi:
    """Core collaborative document API tests for MVP regression."""

    def test_get_document_structure(self, api_client):
        """GET /api/document returns valid document structure with pages and blocks."""
        response = api_client.get(f"{API_BASE}/document", timeout=20)
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == "shared-canvas"
        assert isinstance(data["pages"], list) and len(data["pages"]) == 3
        assert [page["title"] for page in data["pages"]] == [
            "Opening Scene",
            "Working Draft",
            "Launch Cut",
        ]
        # At least 1 block must exist (may be blank after new doc creation)
        assert isinstance(data["blocks"], list) and len(data["blocks"]) >= 1
        assert isinstance(data["versions"], list) and len(data["versions"]) >= 1

    def test_add_comment_and_verify_persistence(self, api_client, initial_document):
        block_id = initial_document["blocks"][0]["id"]
        comment_text = f"TEST_comment_{uuid.uuid4().hex[:8]}"
        payload = {
            "block_id": block_id,
            "author_name": "TEST_Bot",
            "author_color": "#22C55E",
            "avatar_url": "https://images.unsplash.com/photo-1520529277867-dbf8c5e0b340?crop=entropy&cs=srgb&fm=jpg&q=85",
            "text": comment_text,
        }

        create_response = api_client.post(f"{API_BASE}/document/comments", json=payload, timeout=20)
        assert create_response.status_code == 200
        created_doc = create_response.json()

        matching = [c for c in created_doc["comments"] if c["text"] == comment_text and c["block_id"] == block_id]
        assert len(matching) == 1

        get_response = api_client.get(f"{API_BASE}/document", timeout=20)
        assert get_response.status_code == 200
        fetched_doc = get_response.json()
        fetched_match = [c for c in fetched_doc["comments"] if c["text"] == comment_text and c["block_id"] == block_id]
        assert len(fetched_match) == 1

    def test_save_annotation_and_verify_persistence(self, api_client, initial_document):
        block_id = initial_document["blocks"][0]["id"]
        note_text = f"TEST_note_{uuid.uuid4().hex[:8]}"

        update_response = api_client.post(
            f"{API_BASE}/document/annotations",
            json={"block_id": block_id, "text": note_text},
            timeout=20,
        )
        assert update_response.status_code == 200

        updated_doc = update_response.json()
        updated_block = next(block for block in updated_doc["blocks"] if block["id"] == block_id)
        assert updated_block["annotation"] == note_text

        get_response = api_client.get(f"{API_BASE}/document", timeout=20)
        assert get_response.status_code == 200
        fetched_doc = get_response.json()
        fetched_block = next(block for block in fetched_doc["blocks"] if block["id"] == block_id)
        assert fetched_block["annotation"] == note_text

    def test_publish_and_published_snapshot(self, api_client):
        publish_response = api_client.post(
            f"{API_BASE}/document/publish",
            json={"author_name": "TEST_Publisher"},
            timeout=20,
        )
        assert publish_response.status_code == 200

        publish_data = publish_response.json()
        assert isinstance(publish_data["first_publish"], bool)
        assert publish_data["document"]["published_snapshot"] is not None
        assert publish_data["document"]["published_snapshot"]["author"] == "TEST_Publisher"

        published_response = api_client.get(f"{API_BASE}/document/published", timeout=20)
        assert published_response.status_code == 200
        published = published_response.json()
        assert published["reason"] == "Published snapshot"
        assert isinstance(published["blocks"], list) and len(published["blocks"]) >= 1

    def test_restore_existing_version(self, api_client):
        document_response = api_client.get(f"{API_BASE}/document", timeout=20)
        assert document_response.status_code == 200
        document = document_response.json()
        assert len(document["versions"]) >= 1

        target_version = document["versions"][0]
        restore_response = api_client.post(f"{API_BASE}/document/restore/{target_version['id']}", timeout=20)
        assert restore_response.status_code == 200
        restored_doc = restore_response.json()

        assert restored_doc["blocks"][0]["id"] == target_version["blocks"][0]["id"]
        assert isinstance(restored_doc["versions"], list) and len(restored_doc["versions"]) >= 1


class TestDocumentWebSocket:
    """WebSocket snapshot/presence smoke tests."""

    def test_websocket_snapshot_and_presence_payload(self):
        websocket = pytest.importorskip("websocket")
        ws = None
        try:
            params = urlencode(
                {
                    "session_id": f"test-{uuid.uuid4().hex[:6]}",
                    "name": "TEST Socket",
                    "color": "#FF0080",
                    "avatar_url": "https://images.unsplash.com/photo-1520529277867-dbf8c5e0b340?crop=entropy&cs=srgb&fm=jpg&q=85",
                }
            )
            ws = websocket.create_connection(f"{_ws_url()}?{params}", timeout=15)
            raw_message = ws.recv()
            assert isinstance(raw_message, str) and raw_message

            import json

            message = json.loads(raw_message)
            assert message["type"] == "snapshot"
            assert message["document"]["id"] == "shared-canvas"
            assert isinstance(message["participants"], list) and len(message["participants"]) >= 1
            assert "session_id" in message
        finally:
            if ws:
                ws.close()
