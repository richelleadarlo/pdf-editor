import { Button } from "@/components/ui/button";
import {
  Upload,
  Type,
  PenLine,
  Download,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Trash2,
} from "lucide-react";

interface Props {
  hasPdf: boolean;
  activeTool: "select" | "text" | "signature" | null;
  onToolChange: (tool: "select" | "text" | "signature") => void;
  onUpload: () => void;
  onSignature: () => void;
  onDownload: () => void;
  onClear: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
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
  onToolChange,
  onUpload,
  onSignature,
  onDownload,
  onClear,
  zoom,
  onZoomIn,
  onZoomOut,
  fontSize,
  fontFamily,
  fontColor,
  onFontSizeChange,
  onFontFamilyChange,
  onFontColorChange,
}: Props) {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2 shadow-sm">
      {/* Upload */}
      <Button variant="outline" size="sm" onClick={onUpload}>
        <Upload className="mr-1 h-4 w-4" /> Upload PDF
      </Button>

      {hasPdf && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />

          {/* Select */}
          <Button
            variant={activeTool === "select" ? "toolbarActive" : "ghost"}
            size="sm"
            onClick={() => onToolChange("select")}
          >
            <MousePointer2 className="mr-1 h-4 w-4" /> Select
          </Button>

          {/* Text */}
          <Button
            variant={activeTool === "text" ? "toolbarActive" : "ghost"}
            size="sm"
            onClick={() => onToolChange("text")}
          >
            <Type className="mr-1 h-4 w-4" /> Text
          </Button>

          {/* Signature */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignature}
          >
            <PenLine className="mr-1 h-4 w-4" /> Signature
          </Button>

          {activeTool === "text" && (
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

          {/* Zoom */}
          <Button variant="ghost" size="icon" onClick={onZoomOut} disabled={zoom <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={onZoomIn} disabled={zoom >= 3}>
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          {/* Download */}
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
