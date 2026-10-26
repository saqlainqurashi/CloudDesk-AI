# CloudDesk AI

CloudDesk AI is a document workspace for uploading files, viewing extracted text, downloading originals, and generating AI summaries. The React frontend talks to a FastAPI backend, which stores document files in Amazon S3 and document metadata and extracted text in PostgreSQL.

## Features

- Upload PDF, TXT, DOCX, PNG, JPG, and JPEG files up to 10 MB.
- Extract text from text-based PDF, TXT, and DOCX files.
- View extracted text and check document processing status.
- Download original files using short-lived S3 links.
- Generate document summaries with Google Gemini.
- Store document metadata in PostgreSQL and original files in S3.

Scanned PDFs and image files are accepted, but OCR is not currently implemented; these files are marked as needing OCR. Text extraction is limited to 1,000,000 characters per document, and summarization uses at most the first 100,000 characters.

## Requirements

- Docker Desktop with Docker Compose
- An AWS account, an S3 bucket, and credentials authorized to upload, download, and delete objects in that bucket
- A Gemini API key to use AI summaries

## Run with Docker Compose

1. Create a `.env` file in the repository root. This file is ignored by Git.

   ```env
   AWS_DEFAULT_REGION=us-east-1
   S3_BUCKET=your-s3-bucket-name
   AWS_ACCESS_KEY_ID=your-aws-access-key-id
   AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
   GEMINI_API_KEY=your-gemini-api-key
   # Optional; defaults to gemini-3.5-flash-lite
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

   Use credentials for an AWS identity with access to the configured bucket. Keep `.env` private and never commit real credentials. `DATABASE_URL` is set by Docker Compose for its local PostgreSQL service.

2. From the repository root, build and start the application:

   ```powershell
   docker compose up --build
   ```

3. Open the frontend at <http://localhost:5173>. The API is at <http://localhost:8000>, with interactive documentation at <http://localhost:8000/docs> and a health check at <http://localhost:8000/api/health>.

To stop the services, press `Ctrl+C`, then run:

```powershell
docker compose down
```

PostgreSQL data is kept in the `postgres_data` Docker volume. To remove the containers and that database volume, run `docker compose down --volumes`; this does not delete objects from S3.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Check backend health |
| `GET` | `/api/documents` | List uploaded documents |
| `POST` | `/api/documents` | Upload a document as multipart form data using the `file` field |
| `GET` | `/api/documents/{document_id}/text` | Get extracted text and processing status |
| `GET` | `/api/documents/{document_id}/download` | Redirect to a temporary S3 download link |
| `POST` | `/api/documents/{document_id}/summary` | Generate or retrieve a cached Gemini summary |

## Technology

- Frontend: React 19 and Vite
- Backend: Python 3.12, FastAPI, and Uvicorn
- Database: PostgreSQL 16
- File storage: Amazon S3 via Boto3
- Summarization: Google Gemini via the Google GenAI SDK