export interface TextEdit {
  id: string;
  type: "text";
  content: string;
  richContent?: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold?: boolean;
  underline?: boolean;
  indent?: number;
  page: number;
  width?: number;
}

export interface SignatureEdit {
  id: string;
  type: "signature";
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface OriginalTextEdit {
  id: string;
  type: "original-text";
  originalContent: string;
  content: string;
  richContent?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold?: boolean;
  underline?: boolean;
  indent?: number;
  page: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  pdfFontSize: number;
}

export type EditItem = TextEdit | SignatureEdit | OriginalTextEdit;

export interface DetectedTextItem {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  page: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  pdfFontSize: number;
}

export interface RenderedPageSnapshot {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
}

export type EditUpdate = Partial<TextEdit> | Partial<SignatureEdit> | Partial<OriginalTextEdit>;

export interface StoredPdfDocumentSummary {
  id: string;
  pdfFileName: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
}

export interface StoredPdfDocument extends StoredPdfDocumentSummary {
  pdfBytes: Uint8Array;
  edits: EditItem[];
}
