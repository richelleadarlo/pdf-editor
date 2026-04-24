import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Upload,
  Type,
  PenLine,
  Download,
  MousePointer2,
  Redo2,
  Undo2,
  Trash2,
  CopyPlus,
} from "lucide-react";
import type { ThemeMode } from "@/hooks/use-theme";

interface Props {
  documentName: string;
  hasPdf: boolean;
  activeTool: "select" | "text" | "signature" | null;
  showTextControls: boolean;
  onToolChange: (tool: "select" | "text" | "signature") => void;
  onBackToLibrary: () => void;
  onUpload: () => void;
  onSignature: () => void;
  onDownload: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  canDuplicateSelection: boolean;
  onDuplicateSelection: () => void;
  // Text controls
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  fontBold: boolean;
  fontItalic: boolean;
  fontUnderline: boolean;
  onFontSizeChange: (v: number) => void;
  onFontFamilyChange: (v: string) => void;
  onFontColorChange: (v: string) => void;
  onFontBoldChange: () => void;
  onFontItalicChange: () => void;
  onFontUnderlineChange: () => void;
}

export function Toolbar({
  documentName,
  hasPdf,
  activeTool,
  showTextControls,
  onToolChange,
  onBackToLibrary,
  onUpload,
  onSignature,
  onDownload,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  canDuplicateSelection,
  onDuplicateSelection,
  fontSize,
  fontFamily,
  fontColor,
  fontBold,
  fontItalic,
  fontUnderline,
  onFontSizeChange,
  onFontFamilyChange,
  onFontColorChange,
  onFontBoldChange,
  onFontItalicChange,
  onFontUnderlineChange,
}: Props) {
  return (
    <div
      data-text-toolbar="true"
      className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2 shadow-sm"
    >
      <Button variant="ghost" size="sm" onClick={onBackToLibrary}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Library
      </Button>

      {hasPdf && documentName ? (
        <div className="max-w-48 truncate px-1 text-sm font-medium text-foreground">{documentName}</div>
      ) : null}

      <div className="mx-1 hidden h-6 w-px bg-border md:block" />

      <Button variant="outline" size="sm" onClick={onUpload}>
        <Upload className="mr-1 h-4 w-4" /> Import PDF
      </Button>

      {hasPdf && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />

          <Button
            variant={activeTool === "select" ? "toolbarActive" : "ghost"}
            size="sm"
            onClick={() => onToolChange("select")}
          >
            <MousePointer2 className="mr-1 h-4 w-4" /> Select
          </Button>

          <Button
            variant={activeTool === "text" ? "toolbarActive" : "ghost"}
            size="sm"
            onClick={() => onToolChange("text")}
          >
            <Type className="mr-1 h-4 w-4" /> Text
          </Button>

          <Button variant="ghost" size="sm" onClick={onSignature}>
            <PenLine className="mr-1 h-4 w-4" /> Signature
          </Button>

          <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo}>
            <Undo2 className="mr-1 h-4 w-4" /> Undo
          </Button>

          <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo}>
            <Redo2 className="mr-1 h-4 w-4" /> Redo
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicateSelection}
            disabled={!canDuplicateSelection}
          >
            <CopyPlus className="mr-1 h-4 w-4" /> Duplicate to page {currentPage}
          </Button>

          {showTextControls && (
            <>
              <div className="mx-1 h-6 w-px bg-border" />
              <select
                value={fontFamily}
                onChange={(e) => onFontFamilyChange(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier">Courier</option>
              </select>
              <input
                type="number"
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className="h-8 w-14 rounded-md border border-input bg-background px-2 text-xs"
                min={8}
                max={72}
              />
              <input
                type="color"
                value={fontColor}
                onChange={(e) => onFontColorChange(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-input"
              />
              <Button
                variant={fontBold ? "toolbarActive" : "ghost"}
                size="sm"
                onClick={onFontBoldChange}
                className="h-8 px-2 text-xs"
                title="Bold"
              >
                B
              </Button>
              <Button
                variant={fontItalic ? "toolbarActive" : "ghost"}
                size="sm"
                onClick={onFontItalicChange}
                className="h-8 px-2 text-xs italic"
                title="Italic"
              >
                I
              </Button>
              <Button
                variant={fontUnderline ? "toolbarActive" : "ghost"}
                size="sm"
                onClick={onFontUnderlineChange}
                className="h-8 px-2 text-xs"
                title="Underline"
              >
                U
              </Button>
            </>
          )}

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background/80 px-1 py-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPreviousPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-20 text-center text-xs text-muted-foreground">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextPage}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1" />

          <Button variant="default" size="sm" onClick={onDownload}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>

          <Button variant="ghost" size="icon" onClick={onClear} title="Remove PDF">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
}
