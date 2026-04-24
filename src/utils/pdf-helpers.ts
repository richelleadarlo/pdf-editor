import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { EditItem, OriginalTextEdit, TextEdit } from "@/lib/pdf-types";
import {
  TEXT_BOX_HORIZONTAL_PADDING,
  TEXT_BOX_LINE_HEIGHT,
  TEXT_BOX_VERTICAL_PADDING,
} from "@/lib/text-layout";

const EXACT_EXPORT_SCALE = 4.5;

export function dataUrlToUint8Array(base64: string): Uint8Array {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(raw);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBlob(bytes: Uint8Array, type = "application/pdf") {
  return new Blob([bytes], { type });
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

const FONT_MAP: Record<string, { regular: string; bold: string }> = {
  Helvetica: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
  },
  "Times New Roman": {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesBold,
  },
  Courier: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
  },
};

function getFontKey(fontFamily: string, bold?: boolean) {
  const familyMap = FONT_MAP[fontFamily] ?? FONT_MAP.Helvetica;
  return bold ? familyMap.bold : familyMap.regular;
}

function drawPdfMultilineText(options: {
  page: PDFPage;
  content: string;
  x: number;
  topY: number;
  fontSize: number;
  font: PDFFont;
  color: ReturnType<typeof rgb>;
  lineHeight: number;
  maxWidth?: number;
  underline?: boolean;
  indent?: number;
}) {
  const {
    page,
    content,
    x,
    topY,
    fontSize,
    font,
    color,
    lineHeight,
    maxWidth,
    underline,
    indent,
  } = options;
  const firstLineIndent = Math.max(0, indent ?? 0);
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const baselineY = topY - fontSize - index * lineHeight;
    const lineIndent = index === 0 ? firstLineIndent : 0;
    const lineX = x + lineIndent;
    const lineMaxWidth =
      typeof maxWidth === "number" ? Math.max(0, maxWidth - lineIndent) : undefined;
    page.drawText(line, {
      x: lineX,
      y: baselineY,
      size: fontSize,
      maxWidth: lineMaxWidth,
      lineHeight,
      font,
      color,
    });

    if (underline && line.length > 0) {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      page.drawLine({
        start: { x: lineX, y: baselineY - 1 },
        end: { x: lineX + textWidth, y: baselineY - 1 },
        thickness: Math.max(0.75, fontSize * 0.06),
        color,
      });
    }
  });
}

export async function exportPdfWithEdits(
  pdfBytes: Uint8Array,
  edits: EditItem[],
  canvasScales: Map<number, { scaleX: number; scaleY: number }>,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  for (const edit of edits) {
    const pageIndex = edit.page - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { height: pageH } = page.getSize();
    const scale = canvasScales.get(edit.page) || { scaleX: 1, scaleY: 1 };

    if (edit.type === "original-text") {
      const oe = edit as OriginalTextEdit;
      const pdfX = oe.x / scale.scaleX;
      const pdfTopY = pageH - oe.y / scale.scaleY;
      const pdfWidth = oe.width / scale.scaleX;
      const pdfHeight = oe.height / scale.scaleY;
      const pdfFontSize = oe.fontSize / scale.scaleY;
      const padding = 2;

      page.drawRectangle({
        x: pdfX - padding,
        y: pdfTopY - pdfHeight - padding,
        width: pdfWidth + padding * 2,
        height: pdfHeight + padding * 2,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });

      const fontKey = getFontKey(oe.fontFamily, oe.bold);
      const font = await pdfDoc.embedFont(fontKey);
      drawPdfMultilineText({
        page,
        content: oe.content,
        x: pdfX,
        topY: pdfTopY,
        fontSize: pdfFontSize,
        maxWidth: pdfWidth,
        lineHeight: pdfFontSize * 1.2,
        font,
        color: hexToRgb(oe.color),
        underline: oe.underline,
        indent: oe.indent,
      });
    } else if (edit.type === "text") {
      const textEdit = edit as TextEdit;
      const fontKey = getFontKey(textEdit.fontFamily, textEdit.bold);
      const font = await pdfDoc.embedFont(fontKey);
      const pdfX = textEdit.x / scale.scaleX;
      const pdfTopY = pageH - textEdit.y / scale.scaleY;
      const pdfFontSize = textEdit.fontSize / scale.scaleY;
      const maxWidth = textEdit.width ? textEdit.width / scale.scaleX : undefined;

      drawPdfMultilineText({
        page,
        content: textEdit.content,
        x: pdfX,
        topY: pdfTopY,
        fontSize: pdfFontSize,
        lineHeight: pdfFontSize * 1.2,
        maxWidth,
        font,
        color: hexToRgb(textEdit.color),
        underline: textEdit.underline,
        indent: textEdit.indent,
      });
    } else if (edit.type === "signature") {
      const imgBytes = dataUrlToUint8Array(edit.image);
      let img;
      if (edit.image.includes("image/png")) {
        img = await pdfDoc.embedPng(imgBytes);
      } else {
        img = await pdfDoc.embedJpg(imgBytes);
      }
      const pdfX = edit.x / scale.scaleX;
      const pdfY = pageH - edit.y / scale.scaleY - edit.height / scale.scaleY;
      page.drawImage(img, {
        x: pdfX,
        y: pdfY,
        width: edit.width / scale.scaleX,
        height: edit.height / scale.scaleY,
      });
    }
  }

  return pdfDoc.save();
}

function wrapTextForCanvas(ctx: CanvasRenderingContext2D, content: string, maxWidth?: number) {
  if (!maxWidth) {
    return content.split("\n");
  }

  const wrappedLines: string[] = [];
  const paragraphs = content.split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/(\s+)/).filter((segment) => segment.length > 0);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine + word;
      if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      wrappedLines.push(currentLine);
      currentLine = word;
    }

    wrappedLines.push(currentLine);
  }

  return wrappedLines.length > 0 ? wrappedLines : [""];
}

function drawCanvasText(options: {
  ctx: CanvasRenderingContext2D;
  edit: TextEdit | OriginalTextEdit;
  currentScale: { scaleX: number; scaleY: number };
  exportScale: number;
}) {
  const { ctx, edit, currentScale, exportScale } = options;
  const exportX = (edit.x / currentScale.scaleX) * exportScale;
  const exportY = (edit.y / currentScale.scaleY) * exportScale;
  const exportWidth = edit.width ? (edit.width / currentScale.scaleX) * exportScale : undefined;
  const exportHeight =
    "height" in edit ? (edit.height / currentScale.scaleY) * exportScale : undefined;
  const exportFontSize = (edit.fontSize / currentScale.scaleY) * exportScale;
  const exportIndent = ((edit.indent ?? 0) / currentScale.scaleX) * exportScale;
  const lineHeight = exportFontSize * TEXT_BOX_LINE_HEIGHT;
  const paddingX = (TEXT_BOX_HORIZONTAL_PADDING / currentScale.scaleX) * exportScale;
  const paddingY = (TEXT_BOX_VERTICAL_PADDING / currentScale.scaleY) * exportScale;

  ctx.save();
  ctx.font = `${edit.bold ? "700 " : ""}${exportFontSize}px ${edit.fontFamily}`;
  ctx.fillStyle = edit.color;
  ctx.textBaseline = "top";

  if (edit.type === "original-text" && exportWidth && exportHeight) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(exportX, exportY, exportWidth + paddingX * 2, exportHeight + paddingY * 2);
    ctx.fillStyle = edit.color;
  }

  const lines = wrapTextForCanvas(ctx, edit.content, exportWidth);
  lines.forEach((line, index) => {
    const lineIndent = index === 0 ? exportIndent : 0;
    const lineX = exportX + paddingX + lineIndent;
    const lineY = exportY + paddingY + index * lineHeight;
    ctx.fillText(line, lineX, lineY);

    if (edit.underline && line.length > 0) {
      const measuredWidth = ctx.measureText(line).width;
      const underlineY = lineY + exportFontSize + 1;
      ctx.beginPath();
      ctx.strokeStyle = edit.color;
      ctx.lineWidth = Math.max(1, exportFontSize * 0.06);
      ctx.moveTo(lineX, underlineY);
      ctx.lineTo(lineX + measuredWidth, underlineY);
      ctx.stroke();
    }
  });
  ctx.restore();
}

async function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function exportPdfExactlyAsEdited(
  pdfBytes: Uint8Array,
  edits: EditItem[],
  canvasScales: Map<number, { scaleX: number; scaleY: number }>,
): Promise<Uint8Array> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  const exportDoc = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const sourcePage = await pdf.getPage(pageNum);
    const originalViewport = sourcePage.getViewport({ scale: 1 });
    const exportViewport = sourcePage.getViewport({ scale: EXACT_EXPORT_SCALE });
    const currentScale = canvasScales.get(pageNum) || { scaleX: 1, scaleY: 1 };

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(exportViewport.width);
    canvas.height = Math.round(exportViewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create export canvas context");
    }

    await sourcePage.render({ canvasContext: ctx, viewport: exportViewport }).promise;

    for (const edit of edits.filter((item) => item.page === pageNum)) {
      if (edit.type === "signature") {
        const signatureImage = await loadImage(edit.image);
        const exportX = (edit.x / currentScale.scaleX) * EXACT_EXPORT_SCALE;
        const exportY = (edit.y / currentScale.scaleY) * EXACT_EXPORT_SCALE;
        const exportWidth = (edit.width / currentScale.scaleX) * EXACT_EXPORT_SCALE;
        const exportHeight = (edit.height / currentScale.scaleY) * EXACT_EXPORT_SCALE;
        ctx.drawImage(signatureImage, exportX, exportY, exportWidth, exportHeight);
        continue;
      }

      drawCanvasText({
        ctx,
        edit,
        currentScale,
        exportScale: EXACT_EXPORT_SCALE,
      });
    }

    const pageImageBytes = dataUrlToUint8Array(canvas.toDataURL("image/png"));
    const embeddedImage = await exportDoc.embedPng(pageImageBytes);
    const exportPage = exportDoc.addPage([originalViewport.width, originalViewport.height]);
    exportPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: originalViewport.width,
      height: originalViewport.height,
    });
  }

  return exportDoc.save();
}

let _idCounter = 0;
export function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `edit_${Date.now()}_${++_idCounter}`;
}
