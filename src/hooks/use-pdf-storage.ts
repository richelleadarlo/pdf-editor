import { useState, useEffect, useCallback, useRef } from "react";

export interface TextEdit {
  id: string;
  type: "text";
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  page: number;
  width?: number;
}

export interface SignatureEdit {
  id: string;
  type: "signature";
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

/** Represents a detected original text item from the PDF that the user has edited */
export interface OriginalTextEdit {
  id: string;
  type: "original-text";
  /** The original text content (before user edit) */
  originalContent: string;
  /** The user-modified content */
  content: string;
  /** Position in canvas-scaled coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  page: number;
  /** Position in PDF points (unscaled) for export */
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  pdfFontSize: number;
}

export type EditItem = TextEdit | SignatureEdit | OriginalTextEdit;

/** Represents a detected text item from pdfjs (not yet edited) */
export interface DetectedTextItem {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  page: number;
  /** PDF-space coordinates for export */
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  pdfFontSize: number;
}

const PDF_KEY = "pdfFile";
const EDITS_KEY = "pdfEdits";
const PDF_NAME_KEY = "pdfFileName";

export function usePdfStorage() {
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [edits, setEdits] = useState<EditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PDF_KEY);
      const storedEdits = localStorage.getItem(EDITS_KEY);
      const storedName = localStorage.getItem(PDF_NAME_KEY);
      if (stored) setPdfBase64(stored);
      if (storedName) setPdfFileName(storedName);
      if (storedEdits) {
        setEdits(JSON.parse(storedEdits));
      }
    } catch (e) {
      console.error("Error loading from localStorage:", e);
    }
    setIsLoading(false);
  }, []);

  // Debounced save edits
  const saveEdits = useCallback((newEdits: EditItem[]) => {
    setEdits(newEdits);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(EDITS_KEY, JSON.stringify(newEdits));
      } catch (e) {
        console.error("Error saving edits:", e);
      }
    }, 400);
  }, []);

  const uploadPdf = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        try {
          localStorage.setItem(PDF_KEY, base64);
          localStorage.setItem(PDF_NAME_KEY, file.name);
          localStorage.removeItem(EDITS_KEY);
          setPdfBase64(base64);
          setPdfFileName(file.name);
          setEdits([]);
          resolve(base64);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const clearPdf = useCallback(() => {
    localStorage.removeItem(PDF_KEY);
    localStorage.removeItem(EDITS_KEY);
    localStorage.removeItem(PDF_NAME_KEY);
    setPdfBase64(null);
    setPdfFileName("");
    setEdits([]);
  }, []);

  const addEdit = useCallback((edit: EditItem) => {
    setEdits((prev) => {
      const next = [...prev, edit];
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        localStorage.setItem(EDITS_KEY, JSON.stringify(next));
      }, 400);
      return next;
    });
  }, []);

  const updateEdit = useCallback((id: string, updates: Partial<TextEdit> | Partial<SignatureEdit> | Partial<OriginalTextEdit>) => {
    setEdits((prev) => {
      const next = prev.map((e) => {
        if (e.id !== id) return e;
        return { ...e, ...updates } as EditItem;
      });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        localStorage.setItem(EDITS_KEY, JSON.stringify(next));
      }, 400);
      return next;
    });
  }, []);

  const removeEdit = useCallback((id: string) => {
    setEdits((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        localStorage.setItem(EDITS_KEY, JSON.stringify(next));
      }, 400);
      return next;
    });
  }, []);

  return {
    pdfBase64,
    pdfFileName,
    edits,
    isLoading,
    uploadPdf,
    clearPdf,
    addEdit,
    updateEdit,
    removeEdit,
    saveEdits,
  };
}
