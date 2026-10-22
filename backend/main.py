
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote
import os
import tempfile
import uuid

import boto3
import psycopg
from psycopg.rows import dict_row
from botocore.exceptions import ClientError
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

DATABASE_URL = os.environ["DATABASE_URL"]
S3_BUCKET = os.environ["S3_BUCKET"]
AWS_REGION = os.environ["AWS_DEFAULT_REGION"]

s3 = boto3.client("s3", region_name=AWS_REGION)

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".png", ".jpg", ".jpeg", ".docx"}


def get_db():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                stored_name TEXT NOT NULL UNIQUE,
                size BIGINT NOT NULL,
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

    return rows


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()

    if not original_name or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported file type.")

    document_id = str(uuid.uuid4())
    stored_name = f"{document_id}{extension}"
    size = 0
    uploaded_to_s3 = False

    try:
        # Temporary staging only; the permanent copy goes to S3.
        with tempfile.SpooledTemporaryFile(
            max_size=2 * 1024 * 1024, mode="w+b"
        ) as temp_file:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break

                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        413, "File exceeds the 10 MB limit."
                    )

                temp_file.write(chunk)

            temp_file.seek(0)

            s3.upload_fileobj(
                temp_file,
                S3_BUCKET,
                stored_name,
                ExtraArgs={
                    "ContentType": "application/octet-stream"
                },
            )
            uploaded_to_s3 = True

        # Store metadata only after the S3 upload succeeds.
        with get_db() as conn:
            conn.execute("""
                INSERT INTO documents (id, filename, stored_name, size)
                VALUES (%s, %s, %s, %s)
            """, (document_id, original_name, stored_name, size))

        return {
            "id": document_id,
            "filename": original_name,
            "size": size,
            "message": "Upload successful",
        }

    except HTTPException:
        raise

    except Exception:
        # Best-effort cleanup if metadata insertion or upload fails.
        if uploaded_to_s3:
            try:
                s3.delete_object(
                    Bucket=S3_BUCKET, Key=stored_name
                )
            except ClientError:
                pass
        raise HTTPException(500, "Document upload failed.")

    finally:
        await file.close()


@app.get("/api/documents/{document_id}/download")
def download_document(document_id: str):
    with get_db() as conn:
        row = conn.execute("""
            SELECT filename, stored_name
            FROM documents
            WHERE id = %s
        """, (document_id,)).fetchone()

    if row is None:
        raise HTTPException(404, "Document not found.")

    try:
        # The URL grants temporary access to this one object.
        url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": row["stored_name"],
                "ResponseContentDisposition": (
                    "attachment; filename*=UTF-8''"
                    + quote(row["filename"], safe="")
                ),
            },
            ExpiresIn=60,
        )
    except ClientError:
        raise HTTPException(502, "Could not create download link.")

    return RedirectResponse(url=url, status_code=307)
