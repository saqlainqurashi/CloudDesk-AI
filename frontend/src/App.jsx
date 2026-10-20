
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000/api";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDocuments() {
    try {
      const response = await fetch(`${API}/documents`);
      if (!response.ok) throw new Error("Could not load documents.");
      setDocuments(await response.json());
    } catch {
      setMessage("Cannot reach the API. Is the backend running?");
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API}/documents`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Upload failed.");

      setMessage(`${result.filename} uploaded successfully.`);
      setFile(null);
      event.target.reset();
      await loadDocuments();
    } catch (error) {
      setMessage(error.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="/">CloudDesk <span>AI</span></a>
        <span className="status"><i /> Local environment</span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR DOCUMENT WORKSPACE</p>
        <h1>All your files.<br /><span>One intelligent space.</span></h1>
        <p className="subtitle">
          Upload, organize, and prepare your documents for AI-powered analysis.
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Upload a document</h2>
            <p>PDF, TXT, PNG, JPG, or DOCX · Maximum 10 MB</p>
          </div>
          <span className="upload-icon">↑</span>
        </div>

        <form onSubmit={handleUpload}>
          <label className="dropzone">
            <span className="file-icon">↥</span>
            <strong>{file ? file.name : "Choose a file to upload"}</strong>
            <span>{file ? formatSize(file.size) : "Click here to browse your computer"}</span>
            <input
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button disabled={loading || !file}>
            {loading ? "Uploading..." : "Upload document"}
          </button>
        </form>

        {message && <p className="message" role="status">{message}</p>}
      </section>

      <section className="documents">
        <div className="section-heading">
          <div>
            <h2>Your documents</h2>
            <p>Files registered in your local database</p>
          </div>
          <span className="count">{documents.length} files</span>
        </div>

        {documents.length === 0 ? (
          <div className="empty">
            <div>▤</div>
            <strong>No documents yet</strong>
            <p>Upload your first file to get started.</p>
          </div>
        ) : (
          <div className="file-list">
            {documents.map((doc) => (
              <article className="file-row" key={doc.id}>
                <div className="file-icon">▤</div>
                <div className="file-info">
                  <strong>{doc.filename}</strong>
                  <span>{formatSize(doc.size)} · {doc.uploaded_at}</span>
                </div>
                <a
                  className="download"
                  href={`${API}/documents/${doc.id}/download`}
                >
                  Download ↗
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>CloudDesk AI · Learning project · Local storage</footer>
    </main>
  );
}
