import { useEffect, useRef, useState, useCallback } from "react";
import type { EditItem, DetectedTextItem, EditUpdate } from "@/lib/pdf-types";
import { EditOverlay } from "./EditOverlay";
import { DetectedTextOverlay } from "./DetectedTextOverlay";

const FIXED_RENDER_SCALE = 1.5;

type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
  fontName?: string;
};

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item &&
    Array.isArray((item as { transform?: unknown }).transform)
  );
}

interface Props {
  pdfBytes: Uint8Array;
  edits: EditItem[];
  activeTool: "select" | "text" | "signature" | null;
  onPageClick: (page: number, x: number, y: number) => void;
  onUpdateEdit: (id: string, updates: EditUpdate) => void;
  onRemoveEdit: (id: string) => void;
  onScalesReady: (scales: Map<number, { scaleX: number; scaleY: number }>) => void;
  onEditOriginalText: (item: DetectedTextItem) => void;
  onPageCountChange: (pageCount: number) => void;
  onCurrentPageChange: (page: number) => void;
  selectedEditId: string | null;
  onSelectEdit: (id: string | null) => void;
  editingEditId: string | null;
  onStartEditing: (id: string) => void;
  onFinishEditing: (id: string) => void;
  autoFocusEditId: string | null;
  navigateToPage: number | null;
  onNavigationHandled: () => void;
}

export function PDFViewer({
  pdfBytes,
  edits,
  activeTool,
  onPageClick,
  onUpdateEdit,
  onRemoveEdit,
  onScalesReady,
  onEditOriginalText,
  onPageCountChange,
  onCurrentPageChange,
  selectedEditId,
  onSelectEdit,
  editingEditId,
  onStartEditing,
  onFinishEditing,
  autoFocusEditId,
  navigateToPage,
  onNavigationHandled,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
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
        import.meta.url,
      ).toString();

      const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
      const pages: typeof pageCanvases = [];
      const newScales = new Map<number, { scaleX: number; scaleY: number }>();
      const allDetected: DetectedTextItem[] = [];
      let textIdCounter = 0;

      onPageCountChange(pdf.numPages);

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: FIXED_RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        const originalViewport = page.getViewport({ scale: 1 });
        const scaleX = viewport.width / originalViewport.width;
        const scaleY = viewport.height / originalViewport.height;
        newScales.set(i, { scaleX, scaleY });

        // Extract text content with positions
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if (!isPdfTextItem(item) || !item.str.trim()) continue;
          const tx = item.transform;
          // tx = [scaleX, skewY, skewX, scaleY, translateX, translateY]
          const pdfFontSize = Math.abs(tx[3]) || 12;
          const pdfX = tx[4];
          const pdfY = tx[5];
          const pdfWidth = item.width || item.str.length * pdfFontSize * 0.6;
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
            fontFamily: item.fontName || "Helvetica",
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
  }, [onPageCountChange, onScalesReady, pdfBytes]);

  useEffect(() => {
    renderPdf();
  }, [renderPdf]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!visibleEntry) return;

        const page = Number((visibleEntry.target as HTMLElement).dataset.pageNumber);
        if (!Number.isNaN(page)) {
          onCurrentPageChange(page);
        }
      },
      {
        root: containerRef.current,
        threshold: [0.35, 0.6, 0.85],
      },
    );

    for (const element of pageRefs.current.values()) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [onCurrentPageChange, pageCanvases]);

  useEffect(() => {
    if (!navigateToPage) return;

    const pageElement = pageRefs.current.get(navigateToPage);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      onCurrentPageChange(navigateToPage);
    }

    onNavigationHandled();
  }, [navigateToPage, onCurrentPageChange, onNavigationHandled]);

  const handlePageClick = (e: React.MouseEvent, pageNum: number) => {
    if (activeTool !== "text") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onPageClick(pageNum, x, y);
  };

  // Get IDs of original texts that have been converted to edits
  const editedOriginalIds = new Set(
    edits.filter((edit) => edit.type === "original-text").map((edit) => edit.id),
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
    <div ref={containerRef} className="flex-1 overflow-auto px-4 py-6">
      <div className="flex flex-col items-center gap-6 pb-12">
        {pageCanvases.map((pc) => (
          <div
            key={pc.pageNum}
            ref={(element) => {
              if (element) {
                pageRefs.current.set(pc.pageNum, element);
              } else {
                pageRefs.current.delete(pc.pageNum);
              }
            }}
            data-page-number={pc.pageNum}
            className={`pdf-page-shadow relative rounded-sm bg-card transition-all ${selectedEditId && edits.some((edit) => edit.id === selectedEditId && edit.page === pc.pageNum) ? "ring-2 ring-primary/50" : ""}`}
            style={{ width: pc.width, height: pc.height }}
            onClick={(e) => {
              handlePageClick(e, pc.pageNum);
              if (activeTool === "select") {
                onSelectEdit(null);
              }
            }}
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
                  <DetectedTextOverlay key={dt.id} item={dt} onEdit={onEditOriginalText} />
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
                  isSelected={selectedEditId === edit.id}
                  isEditing={editingEditId === edit.id}
                  autoFocus={autoFocusEditId === edit.id}
                  onSelect={onSelectEdit}
                  onStartEditing={onStartEditing}
                  onFinishEditing={onFinishEditing}
                />
              ))}

            <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted-foreground/60">
              {pc.pageNum}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
