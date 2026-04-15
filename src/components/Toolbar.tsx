import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Type,
  PenLine,
  Download,
  MousePointer2,
  Moon,
  Redo2,
  SunMedium,
  Undo2,
  Trash2,
  CopyPlus,
} from "lucide-react";
import type { ThemeMode } from "@/hooks/use-theme";

interface Props {
  hasPdf: boolean;
  activeTool: "select" | "text" | "signature" | null;
  showTextControls: boolean;
  onToolChange: (tool: "select" | "text" | "signature") => void;
  onUpload: () => void;
  onSignature: () => void;
  onDownload: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
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
  onFontSizeChange: (v: number) => void;
  onFontFamilyChange: (v: string) => void;
  onFontColorChange: (v: string) => void;
}

export function Toolbar({
  hasPdf,
  activeTool,
  showTextControls,
  onToolChange,
  onUpload,
  onSignature,
  onDownload,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  theme,
  onToggleTheme,
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  canDuplicateSelection,
  onDuplicateSelection,
  fontSize,
  fontFamily,
  fontColor,
  onFontSizeChange,
  onFontFamilyChange,
  onFontColorChange,
}: Props) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2 shadow-sm">
      <Button variant="outline" size="sm" onClick={onUpload}>
        <Upload className="mr-1 h-4 w-4" /> Upload PDF
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

          <Button variant="ghost" size="sm" onClick={onToggleTheme}>
            {theme === "dark" ? (
              <SunMedium className="mr-1 h-4 w-4" />
            ) : (
              <Moon className="mr-1 h-4 w-4" />
            )}
            {theme === "dark" ? "Light" : "Dark"}
          </Button>

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
