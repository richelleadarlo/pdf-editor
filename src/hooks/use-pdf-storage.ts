import { useState, useEffect, useCallback, useRef } from "react";
import {
  clearStoredDocument,
  clearStoredEdits,
  getStoredEdits,
  getStoredPdf,
  saveStoredEdits,
  saveStoredPdf,
} from "@/lib/pdf-storage-db";
import type { EditItem, EditUpdate } from "@/lib/pdf-types";
import { dataUrlToUint8Array } from "@/utils/pdf-helpers";

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

export function usePdfStorage() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const edits = history.present;

  useEffect(() => {
    let isMounted = true;

    const loadDocument = async () => {
      try {
        const [storedPdf, storedEdits] = await Promise.all([getStoredPdf(), getStoredEdits()]);

        if (!isMounted) return;

        if (storedPdf) {
          setPdfBytes(storedPdf.pdfBytes);
          setPdfFileName(storedPdf.pdfFileName);
          setHistory({
            past: [],
            present: storedEdits,
            future: [],
          });
        } else {
          const migrated = await migrateLegacyStorage();
          if (!isMounted || !migrated) return;

          setPdfBytes(migrated.pdfBytes);
          setPdfFileName(migrated.pdfFileName);
          setHistory({
            past: [],
            present: migrated.edits,
            future: [],
          });
        }
      } catch (e) {
        console.error("Error loading persisted PDF state:", e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveStoredEdits(edits).catch((error) => {
        console.error("Error saving edits:", error);
      });
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [edits, isLoading]);

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

  const uploadPdf = useCallback(async (file: File) => {
    const nextPdfBytes = new Uint8Array(await file.arrayBuffer());

    await Promise.all([saveStoredPdf(nextPdfBytes, file.name), clearStoredEdits()]);

    setPdfBytes(nextPdfBytes);
    setPdfFileName(file.name);
    setHistory(EMPTY_HISTORY);

    return nextPdfBytes;
  }, []);

  const clearPdf = useCallback(async () => {
    await clearStoredDocument();
    setPdfBytes(null);
    setPdfFileName("");
    setHistory(EMPTY_HISTORY);
  }, []);

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

  return {
    pdfBytes,
    pdfFileName,
    edits,
    isLoading,
    uploadPdf,
    clearPdf,
    addEdit,
    updateEdit,
    previewEdit,
    replaceEdits,
    removeEdit,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
