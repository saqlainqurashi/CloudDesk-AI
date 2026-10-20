
from contextlib import asynccontextmanager
from pathlib import Path
import sqlite3
import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "clouddesk.db"

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".png", ".jpg", ".jpeg", ".docx"}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                stored_name TEXT NOT NULL UNIQUE,
                size INTEGER NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    yield


app = FastAPI(title="CloudDesk AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "CloudDesk AI"}


@app.get("/api/documents")
def list_documents():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, filename, size, uploaded_at
            FROM documents
            ORDER BY uploaded_at DESC
        """).fetchall()

    return [dict(row) for row in rows]


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()

    if not original_name or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported file type.")

    document_id = str(uuid.uuid4())
    stored_name = f"{document_id}{extension}"
    destination = UPLOAD_DIR / stored_name
    size = 0

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break

                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        413, "File exceeds the 10 MB limit."
                    )

                output.write(chunk)

        with get_db() as conn:
            conn.execute("""
                INSERT INTO documents (id, filename, stored_name, size)
                VALUES (?, ?, ?, ?)
            """, (document_id, original_name, stored_name, size))

        return {
            "id": document_id,
            "filename": original_name,
            "size": size,
            "message": "Upload successful"
        }

    except Exception:
        destination.unlink(missing_ok=True)
        raise

    finally:
        await file.close()


@app.get("/api/documents/{document_id}/download")
def download_document(document_id: str):
    with get_db() as conn:
        row = conn.execute("""
            SELECT filename, stored_name
            FROM documents WHERE id = ?
        """, (document_id,)).fetchone()

    if row is None:
        raise HTTPException(404, "Document not found.")

    path = UPLOAD_DIR / row["stored_name"]

    if not path.is_file():
        raise HTTPException(404, "Stored file not found.")

    return FileResponse(path, filename=row["filename"])
