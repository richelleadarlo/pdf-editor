import { useState, useRef, useCallback } from "react";
import { usePdfStorage } from "@/hooks/use-pdf-storage";
import { PDFViewer } from "./PDFViewer";
import { Toolbar } from "./Toolbar";
import { UploadZone } from "./UploadZone";
import { SignatureDialog } from "./SignatureDialog";
import { exportPdfWithEdits, generateId } from "@/utils/pdf-helpers";
import type { EditItem, DetectedTextItem } from "@/hooks/use-pdf-storage";

export function PDFEditor() {
  const {
    pdfBase64,
    pdfFileName,
    edits,
    isLoading,
    uploadPdf,
    clearPdf,
    addEdit,
    updateEdit,
    removeEdit,
  } = usePdfStorage();

  const [activeTool, setActiveTool] = useState<"select" | "text" | "signature" | null>("select");
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("Helvetica");
  const [fontColor, setFontColor] = useState("#000000");
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasScalesRef = useRef<Map<number, { scaleX: number; scaleY: number }>>(new Map());

  const handleUpload = async (file: File) => {
    try {
      await uploadPdf(file);
      setActiveTool("select");
    } catch {
      alert("File too large for browser storage. Try a smaller PDF.");
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
      page: 1,
    };
    addEdit(edit);
    setActiveTool("select");
  };

  const handleEditOriginalText = useCallback((item: DetectedTextItem) => {
    // Check if already being edited
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
  }, [edits, addEdit]);

  const handleDownload = async () => {
    if (!pdfBase64) return;
    try {
      const pdfBytes = await exportPdfWithEdits(pdfBase64, edits, canvasScalesRef.current);
      const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFileName ? `edited_${pdfFileName}` : "edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export PDF.");
    }
  };

  const handleScalesReady = useCallback(
    (scales: Map<number, { scaleX: number; scaleY: number }>) => {
      canvasScalesRef.current = scales;
    },
    []
  );

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
        hasPdf={!!pdfBase64}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onUpload={() => fileInputRef.current?.click()}
        onSignature={() => setSignatureOpen(true)}
        onDownload={handleDownload}
        onClear={clearPdf}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(3, z + 0.25))}
        onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.25))}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontColor={fontColor}
        onFontSizeChange={setFontSize}
        onFontFamilyChange={setFontFamily}
        onFontColorChange={setFontColor}
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

      {pdfBase64 ? (
        <div className="flex-1 overflow-auto bg-muted/40 flex justify-center">
          <PDFViewer
            pdfBase64={pdfBase64}
            edits={edits}
            activeTool={activeTool}
            onPageClick={handlePageClick}
            onUpdateEdit={updateEdit}
            onRemoveEdit={removeEdit}
            onScalesReady={handleScalesReady}
            onEditOriginalText={handleEditOriginalText}
            zoom={zoom}
          />
        </div>
      ) : (
        <UploadZone onFile={handleUpload} />
      )}

      <SignatureDialog
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onSave={handleSignatureSave}
      />
    </div>
  );
}
