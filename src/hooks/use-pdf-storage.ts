import { useState, useEffect, useCallback, useRef } from "react";
import {
  clearLegacyStoredDocument,
  deleteStoredDocument,
  getLegacyStoredDocument,
  getStoredActiveDocumentId,
  getStoredDocument,
  listStoredDocuments,
  renameStoredDocument,
  saveStoredDocument,
  setStoredActiveDocumentId,
  touchStoredDocument,
  updateStoredDocumentEdits,
} from "@/lib/pdf-storage-db";
import type { EditItem, EditUpdate, StoredPdfDocumentSummary } from "@/lib/pdf-types";
import { dataUrlToUint8Array, generateId } from "@/utils/pdf-helpers";

const LEGACY_PDF_KEY = "pdfFile";
const LEGACY_EDITS_KEY = "pdfEdits";
const LEGACY_PDF_NAME_KEY = "pdfFileName";

type HistoryState = {
  past: EditItem[][];
  present: EditItem[];
  future: EditItem[][];
};

type HistoryMode = "push" | "skip";

const EMPTY_HISTORY: HistoryState = {
  past: [],
  present: [],
  future: [],
};

function areEditsEqual(left: EditItem[], right: EditItem[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildNextHistory(previous: HistoryState, nextEdits: EditItem[], historyMode: HistoryMode) {
  if (areEditsEqual(previous.present, nextEdits)) {
    return previous;
  }

  if (historyMode === "skip") {
    return {
      ...previous,
      present: nextEdits,
    };
  }

  return {
    past: [...previous.past, previous.present],
    present: nextEdits,
    future: [],
  };
}

async function migrateLegacyStorage() {
  if (typeof window === "undefined") return null;

  const legacyPdf = window.localStorage.getItem(LEGACY_PDF_KEY);
  if (!legacyPdf) return null;

  const legacyName = window.localStorage.getItem(LEGACY_PDF_NAME_KEY) ?? "document.pdf";
  const legacyEdits = window.localStorage.getItem(LEGACY_EDITS_KEY);
  const parsedEdits = legacyEdits ? (JSON.parse(legacyEdits) as EditItem[]) : [];
  const pdfBytes = dataUrlToUint8Array(legacyPdf);

  await Promise.all([saveStoredPdf(pdfBytes, legacyName), saveStoredEdits(parsedEdits)]);

  window.localStorage.removeItem(LEGACY_PDF_KEY);
  window.localStorage.removeItem(LEGACY_PDF_NAME_KEY);
  window.localStorage.removeItem(LEGACY_EDITS_KEY);

  return {
    pdfBytes,
    pdfFileName: legacyName,
    edits: parsedEdits,
  };
}

export interface UsePdfStorageResult {
  documents: StoredPdfDocumentSummary[];
  activeDocumentId: string | null;
  activeDocument: StoredPdfDocumentSummary | null;
  pdfBytes: Uint8Array | null;
  pdfFileName: string;
  edits: EditItem[];
  isLoading: boolean;
  hasLoaded: boolean;
  uploadPdfs: (files: File[], options?: { openFirst?: boolean }) => Promise<void>;
  openDocument: (id: string) => Promise<void>;
  closeDocument: () => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  renameDocument: (id: string, newFileName: string) => Promise<void>;
  addEdit: (edit: EditItem) => void;
  updateEdit: (id: string, updates: EditUpdate) => void;
  previewEdit: (id: string, updates: EditUpdate) => void;
  replaceEdits: (nextEdits: EditItem[]) => void;
  removeEdit: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function usePdfStorage() {
  const [documents, setDocuments] = useState<StoredPdfDocumentSummary[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const edits = history.present;

  const resetActiveDocumentState = useCallback(() => {
    setPdfBytes(null);
    setPdfFileName("");
    setHistory(EMPTY_HISTORY);
  }, []);

  const refreshDocuments = useCallback(async () => {
    const nextDocuments = await listStoredDocuments();
    setDocuments(nextDocuments);
    return nextDocuments;
  }, []);

  const hydrateActiveDocument = useCallback(
    async (documentId: string, options?: { touch?: boolean }) => {
      const storedDocument = await getStoredDocument(documentId);

      if (!storedDocument) {
        await setStoredActiveDocumentId(null);
        setActiveDocumentId(null);
        resetActiveDocumentState();
        await refreshDocuments();
        return;
      }

      setActiveDocumentId(documentId);
      setPdfBytes(storedDocument.pdfBytes);
      setPdfFileName(storedDocument.pdfFileName);
      setHistory({
        past: [],
        present: storedDocument.edits,
        future: [],
      });

      await setStoredActiveDocumentId(documentId);

      if (options?.touch !== false) {
        await touchStoredDocument(documentId);
      }

      await refreshDocuments();
    },
    [refreshDocuments, resetActiveDocumentState],
  );

  const migrateSingleDocumentIntoLibrary = useCallback(async () => {
    const existingDocuments = await listStoredDocuments();
    if (existingDocuments.length > 0) return null;

    const legacyIndexedDbDocument = await getLegacyStoredDocument();
    const legacyLocalStorageDocument = legacyIndexedDbDocument ?? (await migrateLegacyStorage());

    if (!legacyLocalStorageDocument) {
      return null;
    }

    const now = Date.now();
    const documentId = generateId();

    await saveStoredDocument({
      id: documentId,
      pdfBytes: legacyLocalStorageDocument.pdfBytes,
      pdfFileName: legacyLocalStorageDocument.pdfFileName,
      edits: legacyLocalStorageDocument.edits,
      size: legacyLocalStorageDocument.pdfBytes.byteLength,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    });

    await clearLegacyStoredDocument();
    await setStoredActiveDocumentId(documentId);

    return documentId;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDocumentLibrary = async () => {
      try {
        const migratedDocumentId = await migrateSingleDocumentIntoLibrary();
        const [storedDocuments, storedActiveDocumentId] = await Promise.all([
          listStoredDocuments(),
          getStoredActiveDocumentId(),
        ]);

        if (!isMounted) return;

        setDocuments(storedDocuments);

        // A new tab opened with ?doc=<id> takes priority over the persisted active document.
        let urlDocumentId: string | null = null;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          urlDocumentId = params.get("doc");
          if (urlDocumentId) {
            window.history.replaceState(null, "", window.location.pathname + window.location.hash);
          }
        }

        const nextActiveDocumentId =
          urlDocumentId && storedDocuments.some((d) => d.id === urlDocumentId)
            ? urlDocumentId
            : storedActiveDocumentId && storedDocuments.some((d) => d.id === storedActiveDocumentId)
              ? storedActiveDocumentId
              : migratedDocumentId ?? null;

        if (nextActiveDocumentId) {
          await hydrateActiveDocument(nextActiveDocumentId, { touch: false });
        } else {
          setActiveDocumentId(null);
          resetActiveDocumentState();
        }
      } catch (e) {
        console.error("Error loading persisted PDF state:", e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    };

    loadDocumentLibrary();

    return () => {
      isMounted = false;
    };
  }, [hydrateActiveDocument, migrateSingleDocumentIntoLibrary, resetActiveDocumentState]);

  useEffect(() => {
    if (isLoading || !activeDocumentId) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateStoredDocumentEdits(activeDocumentId, edits)
        .then(() => refreshDocuments())
        .catch((error) => {
        console.error("Error saving edits:", error);
      });
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [activeDocumentId, edits, isLoading, refreshDocuments]);

  const setEditsWithHistory = useCallback(
    (
      nextEdits: EditItem[] | ((current: EditItem[]) => EditItem[]),
      historyMode: HistoryMode = "push",
    ) => {
      setHistory((previous) => {
        const resolvedEdits =
          typeof nextEdits === "function" ? nextEdits(previous.present) : nextEdits;

        return buildNextHistory(previous, resolvedEdits, historyMode);
      });
    },
    [],
  );

  const flushActiveEdits = useCallback(async () => {
    if (!activeDocumentId) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    await updateStoredDocumentEdits(activeDocumentId, edits);
    await refreshDocuments();
  }, [activeDocumentId, edits, refreshDocuments]);

  const uploadPdfs = useCallback(
    async (files: File[], options?: { openFirst?: boolean }) => {
      if (files.length === 0) return;

      setIsLoading(true);

      try {
        if (options?.openFirst) {
          await flushActiveEdits();
        }

        const now = Date.now();
        const documentsToSave = await Promise.all(
          files.map(async (file, index) => ({
            id: generateId(),
            pdfBytes: new Uint8Array(await file.arrayBuffer()),
            pdfFileName: file.name,
            edits: [],
            size: file.size,
            createdAt: now + index,
            updatedAt: now + index,
            lastOpenedAt: now + index,
          })),
        );

        await Promise.all(documentsToSave.map((document) => saveStoredDocument(document)));
        await refreshDocuments();

        if (options?.openFirst && documentsToSave[0]) {
          await hydrateActiveDocument(documentsToSave[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [flushActiveEdits, hydrateActiveDocument, refreshDocuments],
  );

  const openDocument = useCallback(
    async (id: string) => {
      setIsLoading(true);

      try {
        if (activeDocumentId && activeDocumentId !== id) {
          await flushActiveEdits();
        }

        await hydrateActiveDocument(id);
      } finally {
        setIsLoading(false);
      }
    },
    [activeDocumentId, flushActiveEdits, hydrateActiveDocument],
  );

  const closeDocument = useCallback(async () => {
    await flushActiveEdits();
    setActiveDocumentId(null);
    resetActiveDocumentState();
    await setStoredActiveDocumentId(null);
  }, [flushActiveEdits, resetActiveDocumentState]);

  const removeDocument = useCallback(
    async (id: string) => {
      await deleteStoredDocument(id);

      if (activeDocumentId === id) {
        await closeDocument();
      }

      await refreshDocuments();
    },
    [activeDocumentId, closeDocument, refreshDocuments],
  );

  const renameDocument = useCallback(
    async (id: string, newFileName: string) => {
      await renameStoredDocument(id, newFileName);

      if (activeDocumentId === id) {
        setPdfFileName(newFileName);
      }

      await refreshDocuments();
    },
    [activeDocumentId, refreshDocuments],
  );

  const addEdit = useCallback(
    (edit: EditItem) => {
      setEditsWithHistory((current) => [...current, edit]);
    },
    [setEditsWithHistory],
  );

  const updateEdit = useCallback(
    (id: string, updates: EditUpdate) => {
      setEditsWithHistory((current) =>
        current.map((edit) => {
          if (edit.id !== id) return edit;
          return { ...edit, ...updates } as EditItem;
        }),
      );
    },
    [setEditsWithHistory],
  );

  const replaceEdits = useCallback(
    (nextEdits: EditItem[]) => {
      setEditsWithHistory(nextEdits);
    },
    [setEditsWithHistory],
  );

  const removeEdit = useCallback(
    (id: string) => {
      setEditsWithHistory((current) => current.filter((edit) => edit.id !== id));
    },
    [setEditsWithHistory],
  );

  const undo = useCallback(() => {
    setHistory((previous) => {
      if (previous.past.length === 0) return previous;

      const nextPast = previous.past.slice(0, -1);
      const previousEdits = previous.past[previous.past.length - 1];

      return {
        past: nextPast,
        present: previousEdits,
        future: [previous.present, ...previous.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((previous) => {
      if (previous.future.length === 0) return previous;

      const [nextEdits, ...remainingFuture] = previous.future;
      return {
        past: [...previous.past, previous.present],
        present: nextEdits,
        future: remainingFuture,
      };
    });
  }, []);

  const previewEdit = useCallback(
    (id: string, updates: EditUpdate) => {
      setEditsWithHistory(
        (current) =>
          current.map((edit) => {
            if (edit.id !== id) return edit;
            return { ...edit, ...updates } as EditItem;
          }),
        "skip",
      );
    },
    [setEditsWithHistory],
  );

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const activeDocument = activeDocumentId
    ? documents.find((document) => document.id === activeDocumentId) ?? null
    : null;

  return {
    documents,
    activeDocumentId,
    activeDocument,
    pdfBytes,
    pdfFileName,
    edits,
    isLoading,
    hasLoaded,
    uploadPdfs,
    openDocument,
    closeDocument,
    deleteDocument: removeDocument,
    renameDocument,
    addEdit,
    updateEdit,
    previewEdit,
    replaceEdits,
    removeEdit,
    undo,
    redo,
    canUndo,
    canRedo,
  } satisfies UsePdfStorageResult;
}
