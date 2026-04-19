import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Clock3,
  X,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { getStoredDocument } from "@/lib/pdf-storage-db";
import { cn } from "@/lib/utils";
import type { StoredPdfDocumentSummary } from "@/lib/pdf-types";

interface DocumentLibraryProps {
  documents: StoredPdfDocumentSummary[];
  isLoading: boolean;
  onUploadFiles: (files: File[]) => Promise<void>;
  onOpenDocument: (documentId: string) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onRenameDocument: (documentId: string, newName: string) => Promise<void>;
}

function formatBytes(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function buildAccent(index: number) {
  const accents = [
    "from-sky-500/18 via-cyan-400/8 to-white",
    "from-emerald-500/18 via-teal-400/8 to-white",
    "from-amber-500/18 via-orange-400/8 to-white",
    "from-rose-500/18 via-pink-400/8 to-white",
  ];

  return accents[index % accents.length];
}

type SortKey = "recent" | "modified" | "name-asc" | "name-desc" | "size";

const SORT_OPTIONS: { key: SortKey; label: string; icon?: React.ReactNode }[] = [
  { key: "recent", label: "Recent" },
  { key: "modified", label: "Modified" },
  { key: "name-asc", label: "Name", icon: <ArrowDownAZ className="h-3.5 w-3.5" /> },
  { key: "name-desc", label: "Name", icon: <ArrowUpAZ className="h-3.5 w-3.5" /> },
  { key: "size", label: "Size" },
];

const thumbnailCache = new Map<string, string>();
let pdfjsModulePromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjsModule() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import("pdfjs-dist").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      return pdfjsLib;
    });
  }

  return pdfjsModulePromise;
}

async function generateThumbnail(documentId: string) {
  if (thumbnailCache.has(documentId)) {
    return thumbnailCache.get(documentId) ?? null;
  }

  const storedDocument = await getStoredDocument(documentId);
  if (!storedDocument) return null;

  const pdfjsLib = await getPdfjsModule();
  const pdf = await pdfjsLib.getDocument({ data: storedDocument.pdfBytes.slice() }).promise;
  const page = await pdf.getPage(1);
  const initialViewport = page.getViewport({ scale: 1 });
  const targetWidth = 220;
  const scale = targetWidth / initialViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const context = canvas.getContext("2d");
  if (!context) return null;

  await page.render({ canvasContext: context, viewport }).promise;

  const thumbnail = canvas.toDataURL("image/png");
  thumbnailCache.set(documentId, thumbnail);
  return thumbnail;
}

function DocumentThumbnail({ documentId, fileName }: { documentId: string; fileName: string }) {
  const [thumbnail, setThumbnail] = useState<string | null>(thumbnailCache.get(documentId) ?? null);
  const [isLoading, setIsLoading] = useState(!thumbnail);

  useEffect(() => {
    let isCancelled = false;

    if (thumbnailCache.has(documentId)) {
      setThumbnail(thumbnailCache.get(documentId) ?? null);
      setIsLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    setIsLoading(true);

    void generateThumbnail(documentId)
      .then((nextThumbnail) => {
        if (isCancelled) return;
        setThumbnail(nextThumbnail);
      })
      .catch((error) => {
        if (isCancelled) return;
        console.error("Failed to generate PDF thumbnail:", error);
        setThumbnail(null);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [documentId]);

  if (thumbnail) {
    return (
      <img
        src={thumbnail}
        alt={`Preview of ${fileName}`}
        className="h-full w-full rounded-[1.25rem] object-cover object-top"
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[1.25rem] bg-white px-5 py-6 text-slate-800 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {isLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-700">
        {isLoading ? "Generating preview" : "Preview unavailable"}
      </p>
      <p className="mt-2 text-center text-xs leading-5 text-slate-500">
        {isLoading ? "Rendering the first page from your stored PDF." : fileName}
      </p>
    </div>
  );
}

export function DocumentLibrary({
  documents,
  isLoading,
  onUploadFiles,
  onOpenDocument,
  onDeleteDocument,
  onRenameDocument,
}: DocumentLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [showLibrarySummary, setShowLibrarySummary] = useState(
    () => localStorage.getItem("library-summary-hidden") !== "true",
  );

  const handleHideLibrarySummary = () => {
    localStorage.setItem("library-summary-hidden", "true");
    setShowLibrarySummary(false);
  };

  const handleShowLibrarySummary = () => {
    localStorage.removeItem("library-summary-hidden");
    setShowLibrarySummary(true);
  };
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const displayDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? documents.filter((doc) => doc.pdfFileName.toLowerCase().includes(normalizedQuery))
      : documents;

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "recent":
          return b.lastOpenedAt - a.lastOpenedAt;
        case "modified":
          return b.updatedAt - a.updatedAt;
        case "name-asc":
          return a.pdfFileName.localeCompare(b.pdfFileName, undefined, { sensitivity: "base" });
        case "name-desc":
          return b.pdfFileName.localeCompare(a.pdfFileName, undefined, { sensitivity: "base" });
        case "size":
          return b.size - a.size;
      }
    });
  }, [documents, query, sortKey]);

  const openInNewTab = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?doc=${encodeURIComponent(id)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const startRename = (event: React.MouseEvent, doc: StoredPdfDocumentSummary) => {
    event.stopPropagation();
    setRenameValue(doc.pdfFileName.replace(/\.pdf$/i, ""));
    setRenamingId(doc.id);
  };

  const commitRename = async (id: string) => {
    const original = documents.find((doc) => doc.id === id)?.pdfFileName ?? "";
    const trimmed = renameValue.trim();
    const nextName = trimmed ? (trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`) : original;
    setRenamingId(null);
    if (nextName !== original) {
      await onRenameDocument(id, nextName);
    }
  };

  const cancelRename = () => setRenamingId(null);

  const recentDocuments = useMemo(
    () => [...documents].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 8),
    [documents],
  );

  const handleFileSelection = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((file) => file.type === "application/pdf");
    if (files.length === 0) return;
    await onUploadFiles(files);
  };

  return (
    <div className="library-light min-h-screen bg-transparent text-foreground">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/favicon.ico" alt="PDF Editor" className="h-11 w-11 object-contain sm:h-12 sm:w-12" />
            <div>
              <p className="text-lg font-semibold tracking-tight">PDF Editor</p>
              <p className="text-xs text-muted-foreground">Local-first PDF workspace</p>
            </div>
          </div>

          <div className="relative hidden flex-1 md:block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your PDFs"
              className="h-12 w-full rounded-full border border-border/70 bg-muted/70 pl-11 pr-4 text-sm outline-none transition focus:border-primary/40 focus:bg-background"
            />
          </div>

          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={isLoading}>
            <Upload className="h-4 w-4" />
            Import PDFs
          </Button>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={async (event) => {
              await handleFileSelection(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        <div className="px-4 pb-4 md:hidden sm:px-6 lg:px-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your PDFs"
              className="h-11 w-full rounded-full border border-border/70 bg-muted/70 pl-11 pr-4 text-sm outline-none transition focus:border-primary/40 focus:bg-background"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
        {!showLibrarySummary ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full border border-border/60 bg-background/70 px-3 backdrop-blur-sm hover:bg-background"
              onClick={() => handleShowLibrarySummary()}
            >
              Show statistics
            </Button>
          </div>
        ) : null}

        {showLibrarySummary ? (
          <section className="relative rounded-[2rem] border border-border/60 bg-linear-to-br from-slate-50 via-white to-sky-50/70 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 h-9 w-9 rounded-full border border-border/60 bg-background/70 backdrop-blur-sm hover:bg-background"
              onClick={() => handleHideLibrarySummary()}
              aria-label="Hide statistics"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Inspired by Google Docs but tailored for PDFs ;)
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                    Start in the library, jump into editing when a document matters.
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Import multiple PDFs, keep them stored locally in your browser, and open any file into the existing page-aware editor when you need to make changes.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/60 bg-background/80 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stored PDFs</p>
                    <p className="mt-2 text-2xl font-semibold">{documents.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-background/80 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent files</p>
                    <p className="mt-2 text-2xl font-semibold">{recentDocuments.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-background/80 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Storage model</p>
                    <p className="mt-2 text-2xl font-semibold">Local</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="mt-8">
              <p className="mb-4 text-sm font-medium text-foreground">Start a new document</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  className={cn(
                    "group flex min-h-64 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-background/90 px-6 py-8 text-center transition",
                    dragActive ? "border-primary bg-primary/6" : "hover:border-primary/50 hover:shadow-lg",
                  )}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={async (event) => {
                    event.preventDefault();
                    setDragActive(false);
                    await handleFileSelection(event.dataTransfer.files);
                  }}
                  disabled={isLoading}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-primary/10 text-primary transition group-hover:scale-105">
                    <FilePlus2 className="h-10 w-10" />
                  </div>
                  <p className="mt-6 text-lg font-semibold">Blank import</p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                    Drag and drop a batch of PDFs here, or browse your device and build a local document shelf.
                  </p>
                </button>

                <Card className="rounded-[1.75rem] border-border/60 bg-background/80 shadow-none sm:col-span-1 xl:col-span-3">
                  <CardContent className="flex h-full flex-col justify-between gap-6 p-6 sm:flex-row sm:items-end">
                    <div className="max-w-xl">
                      <p className="text-sm font-medium text-foreground">Current workflow</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">
                        Open any PDF card below to launch the existing editor.
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Your files and edits stay in IndexedDB on this device. The editor still supports inline text changes, signatures, page navigation, undo, redo, and export.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      Click a card to open it in the editor
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">PDFs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {displayDocuments.length === documents.length
                  ? `${documents.length} PDF${documents.length === 1 ? "" : "s"} in your workspace`
                  : `Showing ${displayDocuments.length} of ${documents.length} documents`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {SORT_OPTIONS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortKey(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                    sortKey === key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {displayDocuments.length === 0 ? (
            <Card className="rounded-[1.75rem] border-border/60 bg-background/85 shadow-none">
              <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Clock3 className="h-8 w-8" />
                </div>
                <p className="mt-5 text-xl font-semibold">
                  {documents.length === 0 ? "No PDFs in your workspace yet" : "No PDFs match that search"}
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {documents.length === 0
                    ? "Import one or many PDFs to create your library, then open any document into the full editor."
                    : "Try a different file name or clear the search to see the rest of your library."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {displayDocuments.map((document, index) => (
                <ContextMenu key={document.id}>
                  <ContextMenuTrigger asChild>
                  <div
                    className="group"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (renamingId === document.id) return;
                      void onOpenDocument(document.id);
                    }}
                    onKeyDown={(event) => {
                      if (renamingId === document.id) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void onOpenDocument(document.id);
                      }
                    }}
                  >
                  <Card className="overflow-hidden rounded-[1.75rem] border-border/60 bg-background/90 shadow-[0_22px_50px_-38px_rgba(15,23,42,0.55)] transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_30px_70px_-36px_rgba(15,23,42,0.48)]">
                    <div className={cn("relative min-h-56 border-b border-border/60 bg-linear-to-br p-5", buildAccent(index))}>
                      <button
                        type="button"
                        aria-label={`Delete ${document.pdfFileName}`}
                        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground transition hover:text-destructive"
                        onClick={async (event) => {
                          event.stopPropagation();
                          await onDeleteDocument(document.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="mt-4 h-[17rem] overflow-hidden rounded-[1.25rem] bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]">
                        <DocumentThumbnail documentId={document.id} fileName={document.pdfFileName} />
                      </div>
                    </div>

                    <CardContent className="space-y-3 p-5">
                      <div>
                        {renamingId === document.id ? (
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => void commitRename(document.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitRename(document.id);
                              } else if (e.key === "Escape") {
                                cancelRename();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded-md border border-primary/40 bg-background px-2 py-1 text-base font-semibold leading-6 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        ) : (
                          <div className="flex items-start gap-1.5">
                            <p className="line-clamp-2 flex-1 text-base font-semibold leading-6 text-foreground">
                              {document.pdfFileName}
                            </p>
                            <button
                              type="button"
                              aria-label={`Rename ${document.pdfFileName}`}
                              className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                              onClick={(e) => startRename(e, document)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">Updated {formatUpdatedAt(document.updatedAt)}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatBytes(document.size)}</span>
                        <span>Open editor</span>
                      </div>
                    </CardContent>
                  </Card>
                  </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem
                      className="gap-2"
                      onSelect={() => void onOpenDocument(document.id)}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Open in editor
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="gap-2"
                      onSelect={() => openInNewTab(document.id)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in new tab
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="gap-2"
                      onSelect={() => {
                        setRenameValue(document.pdfFileName.replace(/\.pdf$/i, ""));
                        setRenamingId(document.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="gap-2 text-destructive focus:text-destructive"
                      onSelect={() => void onDeleteDocument(document.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}