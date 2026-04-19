import type { EditItem, StoredPdfDocument, StoredPdfDocumentSummary } from "@/lib/pdf-types";

const DB_NAME = "pdf-editor";
const DB_VERSION = 2;
const LEGACY_STORE_NAME = "app-state";
const DOCUMENT_STORE_NAME = "documents";
const SETTINGS_STORE_NAME = "settings";

const PDF_RECORD_KEY = "active-pdf";
const EDITS_RECORD_KEY = "active-edits";
const ACTIVE_DOCUMENT_ID_KEY = "active-document-id";

interface StoreRecord<T> {
  key: string;
  value: T;
}

interface StoredPdfRecord {
  pdfData: ArrayBuffer;
  pdfFileName: string;
  updatedAt: number;
}

interface StoredEditsRecord {
  edits: EditItem[];
  updatedAt: number;
}

interface DocumentRecord {
  id: string;
  pdfData: ArrayBuffer;
  pdfFileName: string;
  edits: EditItem[];
  size: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        database.createObjectStore(LEGACY_STORE_NAME, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
        database.createObjectStore(DOCUMENT_STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function getValue<T>(storeName: string, key: string) {
  const database = await openDatabase();

  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as StoreRecord<T> | undefined;
      resolve(record?.value ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to read from IndexedDB"));
    transaction.oncomplete = () => database.close();
  });
}

async function setValue<T>(storeName: string, key: string, value: T) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.put({ key, value } satisfies StoreRecord<T>);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to write to IndexedDB"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write aborted"));
  });
}

async function deleteValue(storeName: string, key: string) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.delete(key);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to delete from IndexedDB"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB delete aborted"));
  });
}

function clonePdfBytes(pdfBytes: Uint8Array) {
  return pdfBytes.slice().buffer;
}

function toDocumentSummary(record: DocumentRecord): StoredPdfDocumentSummary {
  return {
    id: record.id,
    pdfFileName: record.pdfFileName,
    size: record.size,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastOpenedAt: record.lastOpenedAt,
  };
}

async function getDocumentRecord(id: string) {
  const database = await openDatabase();

  return new Promise<DocumentRecord | null>((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE_NAME, "readonly");
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as DocumentRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to read document"));
    transaction.oncomplete = () => database.close();
  });
}

async function putDocumentRecord(record: DocumentRecord) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    store.put(record);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to save document"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Document save aborted"));
  });
}

async function getAllDocumentRecords() {
  const database = await openDatabase();

  return new Promise<DocumentRecord[]>((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE_NAME, "readonly");
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as DocumentRecord[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to list documents"));
    transaction.oncomplete = () => database.close();
  });
}

async function deleteDocumentRecord(id: string) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    store.delete(id);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to delete document"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Document delete aborted"));
  });
}

export async function getStoredPdf() {
  const record = await getValue<StoredPdfRecord>(LEGACY_STORE_NAME, PDF_RECORD_KEY);
  if (!record) return null;

  return {
    pdfBytes: new Uint8Array(record.pdfData),
    pdfFileName: record.pdfFileName,
  };
}

export function saveStoredPdf(pdfBytes: Uint8Array, pdfFileName: string) {
  return setValue(LEGACY_STORE_NAME, PDF_RECORD_KEY, {
    pdfData: clonePdfBytes(pdfBytes),
    pdfFileName,
    updatedAt: Date.now(),
  } satisfies StoredPdfRecord);
}

export function clearStoredPdf() {
  return deleteValue(LEGACY_STORE_NAME, PDF_RECORD_KEY);
}

export async function getStoredEdits() {
  const record = await getValue<StoredEditsRecord>(LEGACY_STORE_NAME, EDITS_RECORD_KEY);
  return record?.edits ?? [];
}

export function saveStoredEdits(edits: EditItem[]) {
  return setValue(LEGACY_STORE_NAME, EDITS_RECORD_KEY, {
    edits,
    updatedAt: Date.now(),
  } satisfies StoredEditsRecord);
}

export function clearStoredEdits() {
  return deleteValue(LEGACY_STORE_NAME, EDITS_RECORD_KEY);
}

export async function clearStoredDocument() {
  await Promise.all([clearStoredPdf(), clearStoredEdits()]);
}

export async function listStoredDocuments() {
  const records = await getAllDocumentRecords();

  return records
    .map(toDocumentSummary)
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt || right.updatedAt - left.updatedAt);
}

export async function getStoredDocument(id: string): Promise<StoredPdfDocument | null> {
  const record = await getDocumentRecord(id);
  if (!record) return null;

  return {
    ...toDocumentSummary(record),
    pdfBytes: new Uint8Array(record.pdfData),
    edits: record.edits,
  };
}

export function saveStoredDocument(document: StoredPdfDocument) {
  return putDocumentRecord({
    id: document.id,
    pdfData: clonePdfBytes(document.pdfBytes),
    pdfFileName: document.pdfFileName,
    edits: document.edits,
    size: document.size,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    lastOpenedAt: document.lastOpenedAt,
  });
}

export async function updateStoredDocumentEdits(id: string, edits: EditItem[]) {
  const record = await getDocumentRecord(id);
  if (!record) return;

  await putDocumentRecord({
    ...record,
    edits,
    updatedAt: Date.now(),
  });
}

export async function touchStoredDocument(id: string) {
  const record = await getDocumentRecord(id);
  if (!record) return;

  await putDocumentRecord({
    ...record,
    lastOpenedAt: Date.now(),
  });
}

export function deleteStoredDocument(id: string) {
  return deleteDocumentRecord(id);
}

export async function renameStoredDocument(id: string, newFileName: string) {
  const record = await getDocumentRecord(id);
  if (!record) return;

  await putDocumentRecord({
    ...record,
    pdfFileName: newFileName,
    updatedAt: Date.now(),
  });
}

export async function getStoredActiveDocumentId() {
  return getValue<string | null>(SETTINGS_STORE_NAME, ACTIVE_DOCUMENT_ID_KEY);
}

export async function setStoredActiveDocumentId(documentId: string | null) {
  if (!documentId) {
    await deleteValue(SETTINGS_STORE_NAME, ACTIVE_DOCUMENT_ID_KEY);
    return;
  }

  await setValue(SETTINGS_STORE_NAME, ACTIVE_DOCUMENT_ID_KEY, documentId);
}

export async function getLegacyStoredDocument() {
  const [pdfRecord, editsRecord] = await Promise.all([
    getValue<StoredPdfRecord>(LEGACY_STORE_NAME, PDF_RECORD_KEY),
    getValue<StoredEditsRecord>(LEGACY_STORE_NAME, EDITS_RECORD_KEY),
  ]);

  if (!pdfRecord) return null;

  return {
    pdfBytes: new Uint8Array(pdfRecord.pdfData),
    pdfFileName: pdfRecord.pdfFileName,
    edits: editsRecord?.edits ?? [],
  };
}

export function clearLegacyStoredDocument() {
  return clearStoredDocument();
}
