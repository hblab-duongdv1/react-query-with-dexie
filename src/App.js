import React, { useState, useCallback, useRef, useEffect } from "react";
import "./styles.css";
import * as db from "./db";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function App() {
  const [instance, setInstance] = useState(null);
  const [file, setFile] = useState(null);
  const [instantXFDF, setInstantXFDF] = useState(null);
  const [instantJSON, setInstantJSON] = useState(null);
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const container = useRef(null);
  const fileInputRef = useRef(null);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["todos"],
    queryFn: db.getTodos,
  });

  const mutation = useMutation({
    mutationFn: (todo) => db.addTodo(todo),
    onSuccess: () => {
      setNewTodo("");
      refetch();
    },
  });

  // File upload handler
  const handleFileUpload = useCallback(async (e) => {
    const selectedFile = e.target.files[0];
    if (
      selectedFile &&
      selectedFile.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      setFile(selectedFile);
      setUploadedFileName(selectedFile.name);

      // Save file to database
      try {
        const documentId = await db.saveDocument(
          selectedFile,
          selectedFile.name
        );
        setCurrentDocumentId(documentId);
        console.log("Document saved with ID:", documentId);
      } catch (error) {
        console.error("Error saving document:", error);
      }
    } else {
      alert("Please select a valid .docx file");
    }
  });

  // Save annotations function
  const handleSaveAnnotations = useCallback(async () => {
    if (instance && currentDocumentId) {
      try {
        const instantXFDF = await instance.exportXFDF();
        const instantJSON = await instance.exportInstantJSON();
        const annotationsData = {
          instantXFDF,
          instantJSON,
        };
        await db.saveAnnotations(currentDocumentId, annotationsData);
        console.log("Annotations saved successfully");
        alert("Annotations saved successfully!");
      } catch (error) {
        console.error("Error saving annotations:", error);
        alert("Error saving annotations");
      }
    }
  }, [instance, currentDocumentId]);

  // Load document from database
  const loadDocumentFromDB = useCallback(async (documentId) => {
    try {
      const doc = await db.getDocument(documentId);
      if (doc) {
        setFile(doc.blob);
        setUploadedFileName(doc.fileName);
        setCurrentDocumentId(documentId);

        // Load annotations if they exist
        const savedAnnotation = await db.getAnnotations(documentId);
        if (savedAnnotation) {
          setInstantXFDF(savedAnnotation.instantXFDF);
          setInstantJSON(savedAnnotation.instantJSON);
        }
      }
    } catch (error) {
      console.error("Error loading document from DB:", error);
    }
  }, []);

  // Load all documents from database on component mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const documents = await db.getAllDocuments();
        if (documents.length > 0) {
          // Load the most recent document
          const mostRecent = documents[documents.length - 1];
          await loadDocumentFromDB(mostRecent.id);
        } else {
          // No documents in database, clear all states
          setFile(null);
          setUploadedFileName("");
          setCurrentDocumentId(null);
          setInstantXFDF(null);
          setInstantJSON(null);
          setInstance(null);
        }
      } catch (error) {
        console.error("Error loading documents:", error);
        // Clear states on error
        setFile(null);
        setUploadedFileName("");
        setCurrentDocumentId(null);
        setInstantXFDF(null);
        setInstantJSON(null);
        setInstance(null);
      }
    };

    loadDocuments();
  }, [loadDocumentFromDB]);

  /**
   * Load local docx file from db
   */
  useEffect(() => {
    if (!container.current || !file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const blob = new Blob([arrayBuffer], { type: file.type });
      const url = URL.createObjectURL(blob);

      // Unload the previous instance
      if (window.NutrientViewer && window.NutrientViewer.unload) {
        window.NutrientViewer.unload(container.current);
      }

      // Load the new instance
      if (window.NutrientViewer && window.NutrientViewer.load) {
        window.NutrientViewer.load({
          container: container.current,
          document: url,
          autoSaveMode: window.NutrientViewer.AutoSaveMode.INTELLIGENT,
          enableClipboardActions: false,
          enableHistory: true,
          locale: "en",
          XFDFKeepCurrentAnnotations: true,
          XFDFIgnorePageRotation: true,
        })
          .then(async (instance) => {
            setInstance(instance);

            // Load saved annotations if they exist
            if (instantXFDF) {
              instance.applyOperations([
                {
                  type: "applyXfdf",
                  xfdf: instantXFDF,
                  ignorePageRotation: true,
                },
              ]);
            }
            if (instantJSON) {
              instance.applyOperations([
                { type: "applyInstantJson", instantJson: instantJSON },
              ]);
            }
          })
          .catch((error) => {
            console.error("Error loading document in NutrientViewer:", error);
          });
      }
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
    };

    reader.readAsArrayBuffer(file);
  }, [file, instantXFDF, instantJSON, currentDocumentId, container]);

  return (
    <div className="App">
      <h1>useQuery (react-query) + Dixie (indexeddb)</h1>
      <p>
        Open a few tabs of this and play with it. It has useQuery() and
        useMutation() hooks to retrieve and add todos
      </p>
      {error && (
        <p style={{ background: "red", color: "white" }}>
          Error loading data: {error.toString()}
        </p>
      )}
      {isFetching ? <p>Loading</p> : null}
      {mutation.isPending ? <p>Saving</p> : null}

      {/* File Upload Section */}
      <div
        style={{
          margin: "20px 0",
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      >
        <h3>Document Upload</h3>

        {!uploadedFileName ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "10px 20px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Upload DOCX File
            </button>
          </div>
        ) : (
          <div>
            <p>
              <strong>Uploaded File:</strong> {uploadedFileName}
            </p>
            <button
              onClick={async () => {
                if (currentDocumentId) {
                  // Delete from database
                  const success = await db.deleteDocument(currentDocumentId);
                  if (success) {
                    console.log("Document removed from database");
                  } else {
                    console.error("Failed to remove document from database");
                  }
                }

                // Clear all states
                setFile(null);
                setUploadedFileName("");
                setCurrentDocumentId(null);
                setInstantXFDF(null);
                setInstantJSON(null);
                setInstance(null);

                // Clear file input
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }

                // Unload NutrientViewer instance
                if (window.NutrientViewer && instance) {
                  try {
                    window.NutrientViewer.unload(container.current);
                  } catch (error) {
                    console.error("Error unloading NutrientViewer:", error);
                  }
                }

                // Clear container content
                if (container.current) {
                  container.current.innerHTML = "";
                }
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Remove File
            </button>
          </div>
        )}
      </div>

      {/* Nutrient Viewer Container */}
      {file && (
        <div style={{ margin: "20px 0" }}>
          <div style={{ marginBottom: "10px" }}>
            <button
              onClick={handleSaveAnnotations}
              disabled={!instance}
              style={{
                padding: "10px 20px",
                backgroundColor: instance ? "#28a745" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: instance ? "pointer" : "not-allowed",
              }}
            >
              Save Annotations
            </button>
          </div>
          <div
            id="nutrient-viewer"
            ref={container}
            style={{ width: "100%", height: "100vh" }}
          ></div>
        </div>
      )}
    </div>
  );
}

window.db = db;
db.connect();
