
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000/api";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatStatus(status) {
  const labels = {
    completed: "Text extracted",
    pending: "Pending",
    needs_ocr: "OCR needed",
    empty: "No text found",
    failed: "Processing failed",
  };

  return labels[status] || status || "Unknown";
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // State for the document text viewer
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [question, setQuestion] = useState("");
const [answer, setAnswer] = useState("");
const [questionLoading, setQuestionLoading] = useState(false);

  useEffect(() => {
  if (selectedDocument) {
    document.getElementById("text-viewer")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}, [selectedDocument]);

  async function loadDocuments() {
    try {
      const response = await fetch(`${API}/documents`);

      if (!response.ok) {
        throw new Error("Could not load documents.");
      }

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

      if (!response.ok) {
        throw new Error(result.detail || "Upload failed.");
      }

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

  async function handleViewText(doc) {
    setSelectedDocument(doc);
    setExtractedText("");
    setTextError("");
    setTextLoading(true);

    try {
      const response = await fetch(
        `${API}/documents/${doc.id}/text`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Could not retrieve document text."
        );
      }

      setSelectedDocument({
        ...doc,
        processing_status: result.processing_status,
      });

      setExtractedText(result.extracted_text || "");

      if (result.processing_status === "needs_ocr") {
        setTextError(
          "This document needs OCR (optical character recognition) before its text can be extracted."
        );
      } else if (result.processing_status === "failed") {
        setTextError(
          result.processing_error || "Text processing failed."
        );
      } else if (!result.extracted_text) {
        setTextError("No extractable text is available for this document.");
      }
    } catch (error) {
      setTextError(error.message || "Could not load document text.");
    } finally {
      setTextLoading(false);
    }
    
  }

  async function handleSummarize() {
    if (!selectedDocument) return;

    setSummary("");
    setSummaryLoading(true);
    setTextError("");

    try {
      const response = await fetch(
        `${API}/documents/${selectedDocument.id}/summary`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Summary generation failed."
        );
      }

      setSummary(result.summary);
    } catch (error) {
      setTextError(
        error.message || "Could not generate summary."
      );
    } finally {
      setSummaryLoading(false);
    }
  }
  
async function handleAskQuestion(event) {
  event.preventDefault();

  if (!selectedDocument || !question.trim()) return;

  setAnswer("");
  setTextError("");
  setQuestionLoading(true);

  try {
    const response = await fetch(
      `${API}/documents/${selectedDocument.id}/ask`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail || "Could not answer the question."
      );
    }

    setAnswer(result.answer);
  } catch (error) {
    setTextError(
      error.message || "Could not answer the question."
    );
  } finally {
    setQuestionLoading(false);
  }
}



  function closeViewer() {
    setSelectedDocument(null);
    setExtractedText("");
    setTextError("");
    setSummary("");
    setSummaryLoading(false);
    setQuestion("");
    setAnswer("");
    setQuestionLoading(false);
  }

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="/">
          CloudDesk <span>AI</span>
        </a>
        <span className="status">
          <i /> Local environment
        </span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR DOCUMENT WORKSPACE</p>
        <h1>
          All your files.
          <br />
          <span>One intelligent space.</span>
        </h1>
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
            <strong>
              {file ? file.name : "Choose a file to upload"}
            </strong>
            <span>
              {file
                ? formatSize(file.size)
                : "Click here to browse your computer"}
            </span>

            <input
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg,.docx"
              onChange={(e) =>
                setFile(e.target.files?.[0] || null)
              }
            />
          </label>

          <button disabled={loading || !file}>
            {loading ? "Uploading..." : "Upload document"}
          </button>
        </form>

        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="documents">
        <div className="section-heading">
          <div>
            <h2>Your documents</h2>
            <p>Files stored in S3 with metadata in PostgreSQL</p>
          </div>
          <span className="count">
            {documents.length} files
          </span>
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
                  <span>
                    {formatSize(doc.size)} · {doc.uploaded_at}
                  </span>
                  <span>
                    Status: {formatStatus(doc.processing_status)}
                  </span>
                </div>

                <div className="file-actions">
                  <button
                    type="button"
                    className="view-button"
                    onClick={() => handleViewText(doc)}
                  >
                    View text
                  </button>

                  <a
                    className="download"
                    href={`${API}/documents/${doc.id}/download`}
                  >
                    Download ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedDocument && (
        <section
          id="text-viewer"
          className="text-viewer"
          aria-labelledby="viewer-title"
          aria-busy={textLoading}
        >

        <div className="section-heading">
          <div>
            <h2 id="viewer-title">{selectedDocument.filename}</h2>
            <p>
              Extracted document text ·{" "}
              {formatStatus(selectedDocument.processing_status)}
            </p>
          </div>

          <div className="file-actions">
            <button
              type="button"
              className="view-button"
              onClick={handleSummarize}
              disabled={summaryLoading || textLoading || !extractedText}
            >
              {summaryLoading ? "Summarizing..." : "✨ Summarize with AI"}
            </button>

            <button
              type="button"
              className="close-button"
              onClick={closeViewer}
            >
              Close
            </button>
          </div>
        </div>


          {textLoading ? (
            <p role="status">Loading document text...</p>
          ) : textError ? (
            <p className="message" role="status">
              {textError}
            </p>
          ) : (
            <pre className="extracted-text">{extractedText}</pre>
          )}
          {summary && (
            <div className="summary-panel">
              <h3>AI Summary</h3>
              <div className="summary-content">{summary}</div>
            </div>
          )}
          
        <div className="qa-panel">
          <h3>Ask about this document</h3>

          <form onSubmit={handleAskQuestion}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. What are the main findings?"
              maxLength={1000}
              rows={3}
              required
            />

            <button
              type="submit"
              className="view-button"
              disabled={questionLoading || !question.trim() || textLoading}
            >
              {questionLoading ? "Thinking..." : "Ask question"}
            </button>
          </form>

          {answer && (
            <div className="answer-panel">
              <h4>Answer</h4>
              <div className="answer-content">{answer}</div>
            </div>
          )}
        </div>

        </section>
      )}

      <footer>CloudDesk AI · Learning project · AWS S3 + PostgreSQL</footer>
    </main>
  );
}