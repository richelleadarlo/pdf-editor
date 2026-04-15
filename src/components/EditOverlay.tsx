import { useRef, useState, useEffect } from "react";
import type { EditItem, TextEdit, SignatureEdit, OriginalTextEdit } from "@/hooks/use-pdf-storage";
import { X } from "lucide-react";

interface Props {
  edit: EditItem;
  onUpdate: (id: string, updates: Partial<TextEdit> | Partial<SignatureEdit> | Partial<OriginalTextEdit>) => void;
  onRemove: (id: string) => void;
  isSelectMode: boolean;
}

export function EditOverlay({ edit, onUpdate, onRemove, isSelectMode }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, origX: 0, origY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, origW: 0, origH: 0 });
  const elRef = useRef<HTMLDivElement>(null);

  // Dragging
  const onMouseDown = (e: React.MouseEvent) => {
    if (!isSelectMode) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, origX: edit.x, origY: edit.y };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      onUpdate(edit.id, {
        x: dragStart.current.origX + dx,
        y: dragStart.current.origY + dy,
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, edit.id, onUpdate]);

  // Resizing (signature only)
  const onResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    if (edit.type === "signature") {
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        origW: edit.width,
        origH: edit.height,
      };
    }
  };

  useEffect(() => {
    if (!isResizing || edit.type !== "signature") return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      onUpdate(edit.id, {
        width: Math.max(40, resizeStart.current.origW + dx),
        height: Math.max(20, resizeStart.current.origH + dy),
      });
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizing, edit.id, edit.type, onUpdate]);

  if (edit.type === "text" || edit.type === "original-text") {
    const isOriginal = edit.type === "original-text";
    return (
      <div
        ref={elRef}
        className="group absolute"
        style={{ left: edit.x, top: edit.y, width: isOriginal ? edit.width : undefined }}
        onMouseDown={onMouseDown}
      >
        {isSelectMode && (
          <button
            className="absolute -right-2 -top-2 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(edit.id);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <div
          className={`cursor-${isSelectMode ? "move" : "default"} rounded px-1 ${isSelectMode ? "outline-dashed outline-1 outline-primary/40 hover:outline-primary" : ""} ${isOriginal ? "bg-accent/30" : ""}`}
          contentEditable={isSelectMode}
          suppressContentEditableWarning
          style={{
            fontSize: edit.fontSize,
            fontFamily: edit.fontFamily,
            color: edit.color,
            minWidth: 20,
            whiteSpace: "pre-wrap",
            outline: "none",
          }}
          onBlur={(e) => {
            onUpdate(edit.id, { content: e.currentTarget.textContent || "" });
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {edit.content}
        </div>
      </div>
    );
  }

  // Signature
  if (edit.type !== "signature") return null;
  return (
    <div
      ref={elRef}
      className="group absolute"
      style={{ left: edit.x, top: edit.y, width: edit.width, height: edit.height }}
      onMouseDown={onMouseDown}
    >
      {isSelectMode && (
        <button
          className="absolute -right-2 -top-2 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(edit.id);
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <img
        src={edit.image}
        alt="Signature"
        className={`h-full w-full object-contain ${isSelectMode ? "outline-dashed outline-1 outline-primary/40 hover:outline-primary" : ""}`}
        draggable={false}
      />
      {isSelectMode && (
        <div
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-tl bg-primary/60"
          onMouseDown={onResizeDown}
        />
      )}
    </div>
  );
}
