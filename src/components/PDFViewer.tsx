import { useEffect, useRef, useState, useCallback } from "react";
import type { EditItem, TextEdit, SignatureEdit, OriginalTextEdit, DetectedTextItem } from "@/hooks/use-pdf-storage";
import { EditOverlay } from "./EditOverlay";
import { DetectedTextOverlay } from "./DetectedTextOverlay";

interface Props {
  pdfBase64: string;
  edits: EditItem[];
  activeTool: "select" | "text" | "signature" | null;
  onPageClick: (page: number, x: number, y: number) => void;
  onUpdateEdit: (id: string, updates: Partial<TextEdit> | Partial<SignatureEdit> | Partial<OriginalTextEdit>) => void;
  onRemoveEdit: (id: string) => void;
  onScalesReady: (scales: Map<number, { scaleX: number; scaleY: number }>) => void;
  onEditOriginalText: (item: DetectedTextItem) => void;
  zoom: number;
}

export function PDFViewer({
  pdfBase64,
  edits,
  activeTool,
  onPageClick,
  onUpdateEdit,
  onRemoveEdit,
  onScalesReady,
  onEditOriginalText,
  zoom,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCanvases, setPageCanvases] = useState<
    { pageNum: number; dataUrl: string; width: number; height: number }[]
  >([]);
  const [detectedTexts, setDetectedTexts] = useState<DetectedTextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scalesRef = useRef<Map<number, { scaleX: number; scaleY: number }>>(new Map());

  const renderPdf = useCallback(async () => {
    if (typeof window === "undefined") return;
    setLoading(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const raw = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
      const binaryString = atob(raw);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const pages: typeof pageCanvases = [];
      const newScales = new Map<number, { scaleX: number; scaleY: number }>();
      const allDetected: DetectedTextItem[] = [];
      let textIdCounter = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 * zoom });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

        const originalViewport = page.getViewport({ scale: 1 });
        const scaleX = viewport.width / originalViewport.width;
        const scaleY = viewport.height / originalViewport.height;
        newScales.set(i, { scaleX, scaleY });

        // Extract text content with positions
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const tx = item.transform;
          // tx = [scaleX, skewY, skewX, scaleY, translateX, translateY]
          const pdfFontSize = Math.abs(tx[3]) || 12;
          const pdfX = tx[4];
          const pdfY = tx[5];
          const pdfWidth = item.width || (item.str.length * pdfFontSize * 0.6);
          const pdfHeight = item.height || pdfFontSize;

          // Convert to canvas coordinates
          const canvasX = pdfX * scaleX;
          // PDF y is from bottom; canvas y is from top
          const canvasY = (originalViewport.height - pdfY - pdfHeight) * scaleY;
          const canvasW = pdfWidth * scaleX;
          const canvasH = pdfHeight * scaleY;

          allDetected.push({
            id: `detected_${i}_${++textIdCounter}`,
            content: item.str,
            x: canvasX,
            y: canvasY,
            width: canvasW,
            height: canvasH,
            fontSize: pdfFontSize * scaleY,
            fontFamily: (item as any).fontName || "Helvetica",
            page: i,
            pdfX,
            pdfY,
            pdfWidth,
            pdfHeight,
            pdfFontSize,
          });
        }

        pages.push({
          pageNum: i,
          dataUrl: canvas.toDataURL(),
          width: viewport.width,
          height: viewport.height,
        });
      }

      scalesRef.current = newScales;
      onScalesReady(newScales);
      setDetectedTexts(allDetected);
      setPageCanvases(pages);
    } catch (err) {
      console.error("PDF render error:", err);
    }
    setLoading(false);
  }, [pdfBase64, zoom, onScalesReady]);

  useEffect(() => {
    renderPdf();
  }, [renderPdf]);

  const handlePageClick = (e: React.MouseEvent, pageNum: number) => {
    if (activeTool !== "text") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onPageClick(pageNum, x, y);
  };

  // Get IDs of original texts that have been converted to edits
  const editedOriginalIds = new Set(
    edits
      .filter((e) => e.type === "original-text")
      .map((e) => (e as OriginalTextEdit).id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
          <span className="text-sm text-muted-foreground">Rendering PDF…</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-6 py-6">
      {pageCanvases.map((pc) => (
        <div
          key={pc.pageNum}
          className="pdf-page-shadow relative rounded-sm bg-card"
          style={{ width: pc.width, height: pc.height }}
          onClick={(e) => handlePageClick(e, pc.pageNum)}
        >
          <img
            src={pc.dataUrl}
            alt={`Page ${pc.pageNum}`}
            className="block"
            style={{ width: pc.width, height: pc.height }}
            draggable={false}
          />

          {/* Detected original text overlays (only in select mode, and only those not yet being edited) */}
          {activeTool === "select" &&
            detectedTexts
              .filter((dt) => dt.page === pc.pageNum && !editedOriginalIds.has(dt.id))
              .map((dt) => (
                <DetectedTextOverlay
                  key={dt.id}
                  item={dt}
                  onEdit={onEditOriginalText}
                />
              ))}

          {/* User edits */}
          {edits
            .filter((e) => e.page === pc.pageNum)
            .map((edit) => (
              <EditOverlay
                key={edit.id}
                edit={edit}
                onUpdate={onUpdateEdit}
                onRemove={onRemoveEdit}
                isSelectMode={activeTool === "select"}
              />
            ))}

          <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted-foreground/60">
            {pc.pageNum}
          </div>
        </div>
      ))}
    </div>
  );
}
