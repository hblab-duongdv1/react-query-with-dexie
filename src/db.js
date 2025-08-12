import Dexie from "dexie";
import { v4 as uuid } from "uuid";

const db = new Dexie("test");

db.version(5).stores({
  todos: "++id,completed",
  documents: "++id,fileName,uploadDate",
  annotations: "documentId,data",
});

export async function getTodos() {
  return db.table("todos").toArray();
}

export async function addTodo(todo) {
  return db
    .table("todos")
    .add({
      ...todo,
      id: uuid(),
    })
    .then((doc) => {
      console.log("saved", doc);
      return doc;
    });
}

// Document management functions
export async function saveDocument(file, fileName) {
  const documentId = uuid();
  const arrayBuffer = await file.arrayBuffer();
  const binaryData = new Uint8Array(arrayBuffer);

  await db.documents.add({
    id: documentId,
    fileName: fileName,
    uploadDate: new Date().toISOString(),
    binaryData: binaryData,
  });

  return documentId;
}

export async function getDocument(documentId) {
  const doc = await db.documents.get(documentId);
  if (doc && doc.binaryData) {
    // Convert back to Blob for use with NutrientViewer
    const blob = new Blob([doc.binaryData], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    return {
      ...doc,
      blob: blob,
    };
  }
  return null;
}

export async function getAllDocuments() {
  return db.documents.toArray();
}

// Annotations management functions
export async function saveAnnotations(documentId, annotationsData) {
  await db.annotations.put({
    documentId: documentId,
    data: annotationsData,
    lastModified: new Date().toISOString(),
  });
}

export async function getAnnotations(documentId) {
  const annotation = await db.annotations.get(documentId);
  return annotation ? annotation.data : null;
}

// Delete document and its annotations
export async function deleteDocument(documentId) {
  try {
    // Delete annotations first
    await db.annotations.delete(documentId);
    // Then delete the document
    await db.documents.delete(documentId);
    console.log("Document and annotations deleted successfully");
    return true;
  } catch (error) {
    console.error("Error deleting document:", error);
    return false;
  }
}

export async function connect() {
  db.open()
    .then(() => console.log("Connected to Dexie"))
    .catch((err) => console.error("Error connecting to Dexie", err));
}
