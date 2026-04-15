import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { EditItem, OriginalTextEdit } from "@/hooks/use-pdf-storage";

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(raw);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

const FONT_MAP: Record<string, string> = {
  Helvetica: StandardFonts.Helvetica,
  "Times New Roman": StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier,
};

export async function exportPdfWithEdits(
  pdfBase64: string,
  edits: EditItem[],
  canvasScales: Map<number, { scaleX: number; scaleY: number }>
): Promise<Uint8Array> {
  const pdfBytes = base64ToArrayBuffer(pdfBase64);
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
      // White-out the original text area
      const padding = 2;
      page.drawRectangle({
        x: oe.pdfX - padding,
        y: oe.pdfY - padding,
        width: oe.pdfWidth + padding * 2,
        height: oe.pdfHeight + padding * 2,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });
      // Draw replacement text
      const fontKey = FONT_MAP[oe.fontFamily] || StandardFonts.Helvetica;
      const font = await pdfDoc.embedFont(fontKey);
      page.drawText(oe.content, {
        x: oe.pdfX,
        y: oe.pdfY,
        size: oe.pdfFontSize,
        font,
        color: hexToRgb(oe.color),
      });
    } else if (edit.type === "text") {
      const fontKey = FONT_MAP[edit.fontFamily] || StandardFonts.Helvetica;
      const font = await pdfDoc.embedFont(fontKey);
      const pdfX = edit.x / scale.scaleX;
      const pdfY = pageH - (edit.y / scale.scaleY) - (edit.fontSize / scale.scaleY);
      page.drawText(edit.content, {
        x: pdfX,
        y: pdfY,
        size: edit.fontSize / scale.scaleY,
        font,
        color: hexToRgb(edit.color),
      });
    } else if (edit.type === "signature") {
      const imgBytes = base64ToArrayBuffer(edit.image);
      let img;
      if (edit.image.includes("image/png")) {
        img = await pdfDoc.embedPng(imgBytes);
      } else {
        img = await pdfDoc.embedJpg(imgBytes);
      }
      const pdfX = edit.x / scale.scaleX;
      const pdfY = pageH - (edit.y / scale.scaleY) - (edit.height / scale.scaleY);
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

let _idCounter = 0;
export function generateId() {
  return `edit_${Date.now()}_${++_idCounter}`;
}
