import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { UsePdfStorageResult } from "@/hooks/use-pdf-storage";
import { PDFViewer } from "./PDFViewer";
import { Toolbar } from "./Toolbar";
import { SignatureDialog } from "./SignatureDialog";
import { PageNavigator } from "./PageNavigator";
import { toast } from "sonner";
import { exportPdfExactlyAsEdited, generateId, uint8ArrayToBlob } from "@/utils/pdf-helpers";
import type { EditItem, DetectedTextItem } from "@/lib/pdf-types";

interface PDFEditorProps {
  storage: UsePdfStorageResult;
}

export function PDFEditor({ storage }: PDFEditorProps) {
  const {
    activeDocument,
    pdfBytes,
    pdfFileName,
    edits,
    isLoading,
    uploadPdfs,
    closeDocument,
    deleteDocument,
    addEdit,
    updateEdit,
    replaceEdits,
    removeEdit,
    undo,
    redo,
    canUndo,
    canRedo,
  } = storage;

  const [activeTool, setActiveTool] = useState<"select" | "text" | "signature" | null>("select");
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("Helvetica");
  const [fontColor, setFontColor] = useState("#000000");
  const [fontBold, setFontBold] = useState(false);
  const [fontItalic, setFontItalic] = useState(false);
  const [fontUnderline, setFontUnderline] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [navigateToPage, setNavigateToPage] = useState<number | null>(null);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [editingEditId, setEditingEditId] = useState<string | null>(null);
  const [autoFocusEditId, setAutoFocusEditId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasScalesRef = useRef<Map<number, { scaleX: number; scaleY: number }>>(new Map());
  const selectionRangeRef = useRef<Range | null>(null);

  const handleUpload = async (file: File) => {
    try {
      await uploadPdfs([file], { openFirst: true });
      setActiveTool("select");
      setCurrentPage(1);
      setNavigateToPage(1);
      setSelectedEditId(null);
      setEditingEditId(null);
      toast.success("PDF stored locally in IndexedDB.");
    } catch {
      toast.error("Failed to store the PDF locally. Try a different file.");
    }
  };

  const handlePageClick = (page: number, x: number, y: number) => {
    if (activeTool !== "text") return;
    const edit: EditItem = {
      id: generateId(),
      type: "text",
      content: "Text",
      x,
      y,
      fontSize,
      fontFamily,
      color: fontColor,
      page,
    };
    addEdit(edit);
    setSelectedEditId(edit.id);
    setEditingEditId(edit.id);
    setAutoFocusEditId(edit.id);
    setActiveTool("select");
  };

  const handleSignatureSave = (dataUrl: string) => {
    const edit: EditItem = {
      id: generateId(),
      type: "signature",
      image: dataUrl,
      x: 100,
      y: 100,
      width: 160,
      height: 80,
      page: currentPage,
    };
    addEdit(edit);
    setSelectedEditId(edit.id);
    setActiveTool("select");
    setSignatureOpen(false);
  };

  const handleEditOriginalText = useCallback(
    (item: DetectedTextItem) => {
      if (edits.some((e) => e.id === item.id)) return;

      addEdit({
        id: item.id,
        type: "original-text",
        originalContent: item.content,
        content: item.content,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily,
        color: "#000000",
        page: item.page,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        pdfWidth: item.pdfWidth,
        pdfHeight: item.pdfHeight,
        pdfFontSize: item.pdfFontSize,
      });
      setSelectedEditId(item.id);
      setEditingEditId(item.id);
      setAutoFocusEditId(item.id);
    },
    [edits, addEdit],
  );

  useEffect(() => {
    if (!autoFocusEditId) return;

    const timeout = window.setTimeout(() => {
      setAutoFocusEditId(null);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [autoFocusEditId]);

  useEffect(() => {
    if (!pdfBytes) {
      setPageCount(1);
      setCurrentPage(1);
      setNavigateToPage(null);
      setSelectedEditId(null);
      setEditingEditId(null);
    }
  }, [pdfBytes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const isEditingField =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (isModifierPressed && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (isModifierPressed && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (
        !isEditingField &&
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedEditId
      ) {
        event.preventDefault();
        removeEdit(selectedEditId);
        setSelectedEditId(null);
        if (editingEditId === selectedEditId) {
          setEditingEditId(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingEditId, redo, removeEdit, selectedEditId, undo]);

  const handleDownload = async () => {
    if (!pdfBytes) return;
    try {
      const outputBytes = await exportPdfExactlyAsEdited(pdfBytes, edits, canvasScalesRef.current);
      const blob = uint8ArrayToBlob(outputBytes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFileName ? `edited_${pdfFileName}` : "edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Edited PDF downloaded.");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export PDF.");
    }
  };

  const handleScalesReady = useCallback(
    (scales: Map<number, { scaleX: number; scaleY: number }>) => {
      canvasScalesRef.current = scales;
    },
    [],
  );

  const editCountByPage = useMemo(() => {
    return edits.reduce<Record<number, number>>((counts, edit) => {
      counts[edit.page] = (counts[edit.page] ?? 0) + 1;
      return counts;
    }, {});
  }, [edits]);

  const selectedEdit = selectedEditId
    ? (edits.find((edit) => edit.id === selectedEditId) ?? null)
    : null;
  const selectedTextEdit =
    selectedEdit && (selectedEdit.type === "text" || selectedEdit.type === "original-text")
      ? selectedEdit
      : null;
  const canDuplicateSelection = Boolean(
    selectedEdit && selectedEdit.type !== "original-text" && selectedEdit.page !== currentPage,
  );

  const applyInlineStyleToSelection = useCallback(
    (styles: Record<string, string>) => {
      if (!selectedTextEdit || editingEditId !== selectedTextEdit.id) {
        return false;
      }

      const editableElement = document.querySelector(
        `[data-editable-text-id='${selectedTextEdit.id}']`,
      ) as HTMLElement | null;
      if (!editableElement) return false;

      const selection = window.getSelection();
      if (!selection) return false;

      if (selection.rangeCount === 0 && selectionRangeRef.current) {
        selection.removeAllRanges();
        selection.addRange(selectionRangeRef.current.cloneRange());
      }

      if (selection.rangeCount === 0) {
        return false;
      }

      const range = selection.getRangeAt(0);
      if (range.collapsed || !editableElement.contains(range.commonAncestorContainer)) {
        return false;
      }

      const fragment = range.extractContents();
      const span = document.createElement("span");

      for (const [key, value] of Object.entries(styles)) {
        if (!value) continue;
        const cssKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
        span.style.setProperty(cssKey, value);
      }

      span.appendChild(fragment);
      range.insertNode(span);

      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      selectionRangeRef.current = nextRange.cloneRange();

      editableElement.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    [editingEditId, selectedTextEdit],
  );

  const applyCommandToSelection = useCallback(
    (command: "bold" | "italic" | "underline") => {
      if (!selectedTextEdit || editingEditId !== selectedTextEdit.id) {
        return false;
      }

      const editableElement = document.querySelector(
        `[data-editable-text-id='${selectedTextEdit.id}']`,
      ) as HTMLElement | null;
      if (!editableElement) return false;

      const selection = window.getSelection();
      if (!selection) return false;

      if (selection.rangeCount === 0 && selectionRangeRef.current) {
        selection.removeAllRanges();
        selection.addRange(selectionRangeRef.current.cloneRange());
      }

      if (selection.rangeCount === 0) {
        return false;
      }

      const range = selection.getRangeAt(0);
      if (range.collapsed || !editableElement.contains(range.commonAncestorContainer)) {
        return false;
      }

      editableElement.focus();
      const applied = document.execCommand(command, false);
      editableElement.dispatchEvent(new Event("input", { bubbles: true }));
      return applied;
    },
    [editingEditId, selectedTextEdit],
  );

  useEffect(() => {
    const handleSelectionChange = () => {
      if (!selectedTextEdit || editingEditId !== selectedTextEdit.id) return;

      const editableElement = document.querySelector(
        `[data-editable-text-id='${selectedTextEdit.id}']`,
      ) as HTMLElement | null;
      if (!editableElement) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (!editableElement.contains(range.commonAncestorContainer)) return;

      selectionRangeRef.current = range.cloneRange();
      setFontBold(document.queryCommandState("bold"));
      setFontItalic(document.queryCommandState("italic"));
      setFontUnderline(document.queryCommandState("underline"));
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [editingEditId, selectedTextEdit]);

  useEffect(() => {
    if (!selectedTextEdit) return;
    setFontSize(selectedTextEdit.fontSize);
    setFontFamily(selectedTextEdit.fontFamily);
    setFontColor(selectedTextEdit.color);
  }, [selectedTextEdit]);

  const handleFontSizeChange = useCallback(
    (value: number) => {
      setFontSize(value);
      if (applyInlineStyleToSelection({ fontSize: `${value}px` })) {
        return;
      }
      if (selectedTextEdit) {
        updateEdit(selectedTextEdit.id, { fontSize: value });
      }
    },
    [applyInlineStyleToSelection, selectedTextEdit, updateEdit],
  );

  const handleFontFamilyChange = useCallback(
    (value: string) => {
      setFontFamily(value);
      if (applyInlineStyleToSelection({ fontFamily: value })) {
        return;
      }
      if (selectedTextEdit) {
        updateEdit(selectedTextEdit.id, { fontFamily: value });
      }
    },
    [applyInlineStyleToSelection, selectedTextEdit, updateEdit],
  );

  const handleFontColorChange = useCallback(
    (value: string) => {
      setFontColor(value);
      if (applyInlineStyleToSelection({ color: value })) {
        return;
      }
      if (selectedTextEdit) {
        updateEdit(selectedTextEdit.id, { color: value });
      }
    },
    [applyInlineStyleToSelection, selectedTextEdit, updateEdit],
  );

  const handleFontBoldChange = useCallback(() => {
    const applied = applyCommandToSelection("bold");
    if (!applied) return;
    setFontBold(document.queryCommandState("bold"));
  }, [applyCommandToSelection]);

  const handleFontItalicChange = useCallback(() => {
    const applied = applyCommandToSelection("italic");
    if (!applied) return;
    setFontItalic(document.queryCommandState("italic"));
  }, [applyCommandToSelection]);

  const handleFontUnderlineChange = useCallback(() => {
    const applied = applyCommandToSelection("underline");
    if (!applied) return;
    setFontUnderline(document.queryCommandState("underline"));
  }, [applyCommandToSelection]);

  const handleNavigatePage = useCallback(
    (page: number) => {
      const nextPage = Math.min(Math.max(page, 1), pageCount);
      setCurrentPage(nextPage);
      setNavigateToPage(nextPage);
    },
    [pageCount],
  );

  const handleDuplicateSelection = useCallback(() => {
    if (
      !selectedEdit ||
      selectedEdit.type === "original-text" ||
      selectedEdit.page === currentPage
    ) {
      return;
    }

    const duplicate = {
      ...selectedEdit,
      id: generateId(),
      page: currentPage,
      x: selectedEdit.x + 18,
      y: selectedEdit.y + 18,
    } as EditItem;

    replaceEdits([...edits, duplicate]);
    setSelectedEditId(duplicate.id);
    toast.success(`Duplicated selection to page ${currentPage}.`);
  }, [currentPage, edits, replaceEdits, selectedEdit]);

  const handleClear = useCallback(async () => {
    if (!activeDocument) return;

    await deleteDocument(activeDocument.id);
    setEditingEditId(null);
    toast.success("Document removed from your local library.");
  }, [activeDocument, deleteDocument]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Toolbar
        documentName={pdfFileName}
        hasPdf={!!pdfBytes}
        activeTool={activeTool}
        showTextControls={activeTool === "text" || !!selectedTextEdit || !!editingEditId}
        onToolChange={setActiveTool}
        onBackToLibrary={closeDocument}
        onUpload={() => fileInputRef.current?.click()}
        onSignature={() => setSignatureOpen(true)}
        onDownload={handleDownload}
        onClear={handleClear}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        currentPage={currentPage}
        totalPages={pageCount}
        onPreviousPage={() => handleNavigatePage(currentPage - 1)}
        onNextPage={() => handleNavigatePage(currentPage + 1)}
        canDuplicateSelection={canDuplicateSelection}
        onDuplicateSelection={handleDuplicateSelection}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontColor={fontColor}
        fontBold={fontBold}
        fontItalic={fontItalic}
        fontUnderline={fontUnderline}
        onFontSizeChange={handleFontSizeChange}
        onFontFamilyChange={handleFontFamilyChange}
        onFontColorChange={handleFontColorChange}
        onFontBoldChange={handleFontBoldChange}
        onFontItalicChange={handleFontItalicChange}
        onFontUnderlineChange={handleFontUnderlineChange}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      {pdfBytes ? (
        <div className="flex min-h-0 flex-1 flex-col bg-muted/40 md:flex-row">
          <PageNavigator
            pageCount={pageCount}
            currentPage={currentPage}
            editCountByPage={editCountByPage}
            onSelectPage={handleNavigatePage}
          />
          <PDFViewer
            pdfBytes={pdfBytes}
            edits={edits}
            activeTool={activeTool}
            onPageClick={handlePageClick}
            onUpdateEdit={updateEdit}
            onRemoveEdit={(id) => {
              removeEdit(id);
              if (selectedEditId === id) {
                setSelectedEditId(null);
              }
              if (editingEditId === id) {
                setEditingEditId(null);
              }
            }}
            onScalesReady={handleScalesReady}
            onEditOriginalText={handleEditOriginalText}
            onPageCountChange={setPageCount}
            onCurrentPageChange={setCurrentPage}
            selectedEditId={selectedEditId}
            onSelectEdit={setSelectedEditId}
            editingEditId={editingEditId}
            onStartEditing={setEditingEditId}
            onFinishEditing={(id) => {
              if (editingEditId === id) {
                setEditingEditId(null);
              }
            }}
            autoFocusEditId={autoFocusEditId}
            navigateToPage={navigateToPage}
            onNavigationHandled={() => setNavigateToPage(null)}
          />
        </div>
      ) : null}

      <SignatureDialog
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onSave={handleSignatureSave}
      />
    </div>
  );
}
