import type { EditItem } from "@/lib/pdf-types";

const DB_NAME = "pdf-editor";
const DB_VERSION = 1;
const STORE_NAME = "app-state";

const PDF_RECORD_KEY = "active-pdf";
const EDITS_RECORD_KEY = "active-edits";

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

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function getValue<T>(key: string) {
  const database = await openDatabase();

  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as StoreRecord<T> | undefined;
      resolve(record?.value ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to read from IndexedDB"));
    transaction.oncomplete = () => database.close();
  });
}

async function setValue<T>(key: string, value: T) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
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

async function deleteValue(key: string) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
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

export async function getStoredPdf() {
  const record = await getValue<StoredPdfRecord>(PDF_RECORD_KEY);
  if (!record) return null;

  return {
    pdfBytes: new Uint8Array(record.pdfData),
    pdfFileName: record.pdfFileName,
  };
}

export function saveStoredPdf(pdfBytes: Uint8Array, pdfFileName: string) {
  return setValue(PDF_RECORD_KEY, {
    pdfData: clonePdfBytes(pdfBytes),
    pdfFileName,
    updatedAt: Date.now(),
  } satisfies StoredPdfRecord);
}

export function clearStoredPdf() {
  return deleteValue(PDF_RECORD_KEY);
}

export async function getStoredEdits() {
  const record = await getValue<StoredEditsRecord>(EDITS_RECORD_KEY);
  return record?.edits ?? [];
}

export function saveStoredEdits(edits: EditItem[]) {
  return setValue(EDITS_RECORD_KEY, {
    edits,
    updatedAt: Date.now(),
  } satisfies StoredEditsRecord);
}

export function clearStoredEdits() {
  return deleteValue(EDITS_RECORD_KEY);
}

export async function clearStoredDocument() {
  await Promise.all([clearStoredPdf(), clearStoredEdits()]);
}
