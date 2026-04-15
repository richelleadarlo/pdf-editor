import { useRef, useState, useEffect, useCallback } from "react";
import type { EditItem, EditUpdate } from "@/lib/pdf-types";
import {
  TEXT_BOX_HORIZONTAL_PADDING,
  TEXT_BOX_LINE_HEIGHT,
  TEXT_BOX_MIN_HEIGHT_MULTIPLIER,
  TEXT_BOX_MIN_RESIZE_WIDTH,
  TEXT_BOX_MIN_WIDTH,
  TEXT_BOX_VERTICAL_PADDING,
} from "@/lib/text-layout";
import { Check, X } from "lucide-react";

interface Props {
  edit: EditItem;
  onUpdate: (id: string, updates: EditUpdate) => void;
  onRemove: (id: string) => void;
  isSelectMode: boolean;
  isSelected: boolean;
  isEditing: boolean;
  autoFocus: boolean;
  onSelect: (id: string) => void;
  onStartEditing: (id: string) => void;
  onFinishEditing: (id: string) => void;
}

export function EditOverlay({
  edit,
  onUpdate,
  onRemove,
  isSelectMode,
  isSelected,
  isEditing,
  autoFocus,
  onSelect,
  onStartEditing,
  onFinishEditing,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draftPosition, setDraftPosition] = useState({ x: edit.x, y: edit.y });
  const [draftSize, setDraftSize] = useState(() => {
    if (edit.type === "signature") {
      return { width: edit.width, height: edit.height };
    }

    if (edit.type === "original-text") {
      return { width: edit.width, height: edit.height };
    }

    if (edit.type === "text") {
      return {
        width:
          edit.width ?? Math.max(TEXT_BOX_MIN_WIDTH, edit.content.length * edit.fontSize * 0.55),
        height: Math.max(edit.fontSize * TEXT_BOX_MIN_HEIGHT_MULTIPLIER, 32),
      };
    }

    return null;
  });
  const [draftText, setDraftText] = useState(
    edit.type === "text" || edit.type === "original-text" ? edit.content : "",
  );
  const dragStart = useRef({ x: 0, y: 0, origX: 0, origY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, origW: 0, origH: 0 });
  const elRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isDragging) {
      setDraftPosition({ x: edit.x, y: edit.y });
    }
  }, [edit.x, edit.y, isDragging]);

  useEffect(() => {
    if (isResizing) return;

    if (edit.type === "signature") {
      setDraftSize({ width: edit.width, height: edit.height });
      return;
    }

    if (edit.type === "original-text") {
      setDraftSize({ width: edit.width, height: edit.height });
      return;
    }

    if (edit.type === "text") {
      setDraftSize({
        width:
          edit.width ?? Math.max(TEXT_BOX_MIN_WIDTH, edit.content.length * edit.fontSize * 0.55),
        height: Math.max(edit.fontSize * TEXT_BOX_MIN_HEIGHT_MULTIPLIER, 32),
      });
    }
  }, [edit, isResizing]);

  useEffect(() => {
    if (edit.type !== "text" && edit.type !== "original-text") return;
    if (!isEditing) {
      setDraftText(edit.content);
    }
  }, [edit, isEditing]);

  useEffect(() => {
    if (!autoFocus || !textareaRef.current) return;

    textareaRef.current.focus();
    const length = textareaRef.current.value.length;
    textareaRef.current.setSelectionRange(length, length);
  }, [autoFocus]);

  useEffect(() => {
    if (!isEditing || !textareaRef.current) return;

    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [draftText, edit.fontSize, isEditing]);

  const commitTextChanges = useCallback(() => {
    if (edit.type !== "text" && edit.type !== "original-text") return;
    const nextContent = draftText.trimEnd() || " ";
    onUpdate(edit.id, { content: nextContent });
    return nextContent;
  }, [draftText, edit, onUpdate]);

  useEffect(() => {
    if (!isEditing || !elRef.current) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || elRef.current?.contains(target)) return;

      commitTextChanges();
      onFinishEditing(edit.id);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [commitTextChanges, edit.id, isEditing, onFinishEditing]);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelectMode) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      const dragHandle = target.closest("[data-drag-handle='true']");

      // While editing, only a dedicated move handle should initiate dragging.
      if (isEditing && !dragHandle) return;

      e.stopPropagation();
      e.preventDefault();
      onSelect(edit.id);
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, origX: edit.x, origY: edit.y };
    },
    [edit.id, edit.x, edit.y, isEditing, isSelectMode, onSelect],
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const nextPosition = {
        x: dragStart.current.origX + dx,
        y: dragStart.current.origY + dy,
      };

      setDraftPosition(nextPosition);
    };
    const onUp = () => {
      setIsDragging(false);
      onUpdate(edit.id, draftPosition);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draftPosition, edit.id, isDragging, onUpdate]);

  const onResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(edit.id);
    setIsResizing(true);

    if (!draftSize) {
      return;
    }

    if (edit.type === "signature" || edit.type === "original-text" || edit.type === "text") {
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        origW: draftSize.width,
        origH: draftSize.height,
      };
    }
  };

  useEffect(() => {
    if (!isResizing || !draftSize) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;

      if (edit.type === "text") {
        setDraftSize({
          width: Math.max(TEXT_BOX_MIN_RESIZE_WIDTH, resizeStart.current.origW + dx),
          height: Math.max(
            edit.fontSize * TEXT_BOX_MIN_HEIGHT_MULTIPLIER,
            resizeStart.current.origH + dy,
          ),
        });
        return;
      }

      if (edit.type === "original-text") {
        setDraftSize({
          width: Math.max(TEXT_BOX_MIN_RESIZE_WIDTH, resizeStart.current.origW + dx),
          height: Math.max(16, resizeStart.current.origH + dy),
        });
        return;
      }

      setDraftSize({
        width: Math.max(40, resizeStart.current.origW + dx),
        height: Math.max(20, resizeStart.current.origH + dy),
      });
    };

    const onUp = () => {
      setIsResizing(false);

      if (edit.type === "text") {
        onUpdate(edit.id, { width: draftSize.width });
        return;
      }

      if (edit.type === "original-text") {
        onUpdate(edit.id, { width: draftSize.width, height: draftSize.height });
        return;
      }

      if (draftSize) {
        onUpdate(edit.id, draftSize);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draftSize, edit, isResizing, onUpdate]);

  if (edit.type === "text" || edit.type === "original-text") {
    const isOriginal = edit.type === "original-text";
    return (
      <div
        ref={elRef}
        className="group absolute"
        style={{
          left: draftPosition.x,
          top: draftPosition.y,
          width: draftSize?.width,
        }}
        onMouseDown={startDrag}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(edit.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onSelect(edit.id);
          onStartEditing(edit.id);
        }}
      >
        {isSelectMode && !isEditing && (
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
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={draftText}
            className={`rounded px-1.5 py-0.5 ${isEditing ? "cursor-text outline-2 outline-primary ring-4 ring-primary/15" : ""} ${isOriginal ? "bg-card/95 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]" : "bg-card/95 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]"}`}
            style={{
              fontSize: edit.fontSize,
              fontFamily: edit.fontFamily,
              color: edit.color,
              minWidth: draftSize?.width ?? (isOriginal ? edit.width : TEXT_BOX_MIN_WIDTH),
              width: draftSize?.width ?? (isOriginal ? edit.width : TEXT_BOX_MIN_WIDTH),
              minHeight: isOriginal
                ? (draftSize?.height ?? edit.height)
                : edit.fontSize * TEXT_BOX_MIN_HEIGHT_MULTIPLIER,
              lineHeight: TEXT_BOX_LINE_HEIGHT,
              paddingLeft: TEXT_BOX_HORIZONTAL_PADDING,
              paddingRight: TEXT_BOX_HORIZONTAL_PADDING,
              paddingTop: TEXT_BOX_VERTICAL_PADDING,
              paddingBottom: TEXT_BOX_VERTICAL_PADDING,
              resize: "none",
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              background: "transparent",
              border: "none",
              outline: "none",
            }}
            onChange={(e) => {
              setDraftText(e.target.value);
            }}
            onBlur={() => {
              commitTextChanges();

              // Keep edit mode active when interacting with drag/resize handles.
              if (isDragging || isResizing) {
                return;
              }

              onFinishEditing(edit.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(edit.id);
            }}
          />
        ) : (
          <div
            className={`rounded px-1.5 py-0.5 ${isSelectMode ? "cursor-move" : "cursor-text"} ${isSelected ? "outline-2 outline-primary/70" : isSelectMode ? "outline-dashed outline-1 outline-primary/40 hover:outline-primary" : ""} ${isOriginal ? "bg-card/95 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]" : "bg-transparent"}`}
            style={{
              fontSize: edit.fontSize,
              fontFamily: edit.fontFamily,
              color: edit.color,
              width: draftSize?.width,
              minWidth: 20,
              minHeight: isOriginal ? (draftSize?.height ?? edit.height) : undefined,
              lineHeight: TEXT_BOX_LINE_HEIGHT,
              paddingLeft: TEXT_BOX_HORIZONTAL_PADDING,
              paddingRight: TEXT_BOX_HORIZONTAL_PADDING,
              paddingTop: TEXT_BOX_VERTICAL_PADDING,
              paddingBottom: TEXT_BOX_VERTICAL_PADDING,
              whiteSpace: "pre-wrap",
              outline: "none",
              userSelect: "none",
            }}
            onMouseDown={startDrag}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(edit.id);
            }}
          >
            {edit.content}
          </div>
        )}
        {isSelectMode && (
          <div
            data-drag-handle="true"
            className={`absolute -top-2 left-1/2 z-20 h-4 w-10 -translate-x-1/2 rounded-full border border-border/70 bg-card/95 shadow-sm ${isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"} cursor-move transition-opacity`}
            onMouseDown={startDrag}
            title="Move text box"
          />
        )}
        {isSelectMode && (
          <div
            className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-tl bg-primary/60"
            onMouseDown={onResizeDown}
            title="Resize text box"
          />
        )}
        {isEditing && (
          <button
            className="absolute -right-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:bg-primary/90"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              commitTextChanges();
              onFinishEditing(edit.id);
            }}
            title="Save text"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Signature
  if (edit.type !== "signature") return null;
  return (
    <div
      ref={elRef}
      className="group absolute"
      style={{
        left: draftPosition.x,
        top: draftPosition.y,
        width: draftSize?.width ?? edit.width,
        height: draftSize?.height ?? edit.height,
      }}
      onMouseDown={startDrag}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(edit.id);
      }}
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
        className={`h-full w-full object-contain ${isSelected ? "outline-2 outline-primary/70" : isSelectMode ? "outline-dashed outline-1 outline-primary/40 hover:outline-primary" : ""}`}
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
