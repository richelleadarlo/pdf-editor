import { useMemo, useRef, useState } from "react";
import {
  Clock3,
  FilePlus2,
  FileText,
  FolderOpen,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StoredPdfDocumentSummary } from "@/lib/pdf-types";

interface DocumentLibraryProps {
  documents: StoredPdfDocumentSummary[];
  isLoading: boolean;
  onUploadFiles: (files: File[]) => Promise<void>;
  onOpenDocument: (documentId: string) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
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

export function DocumentLibrary({
  documents,
  isLoading,
  onUploadFiles,
  onOpenDocument,
  onDeleteDocument,
}: DocumentLibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [query, setQuery] = useState("");

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return documents;

    return documents.filter((document) => document.pdfFileName.toLowerCase().includes(normalizedQuery));
  }, [documents, query]);

  const recentDocuments = filteredDocuments.slice(0, 8);

  const handleFileSelection = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((file) => file.type === "application/pdf");
    if (files.length === 0) return;
    await onUploadFiles(files);
  };

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Docs</p>
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
        <section className="rounded-[2rem] border border-border/60 bg-linear-to-br from-slate-50 via-white to-sky-50/70 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] dark:from-slate-950/40 dark:via-slate-900/70 dark:to-sky-950/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Inspired by the Google Docs launcher, tailored for PDFs
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

        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Recent documents</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredDocuments.length === documents.length
                  ? "Your imported PDFs, sorted by the last document you opened."
                  : `Showing ${filteredDocuments.length} of ${documents.length} documents.`}
              </p>
            </div>
          </div>

          {filteredDocuments.length === 0 ? (
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
              {filteredDocuments.map((document, index) => (
                <div
                  key={document.id}
                  className="group"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDocument(document.id)}
                  onKeyDown={(event) => {
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

                      <div className="mt-4 rounded-[1.25rem] bg-white px-5 py-6 text-slate-800 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] dark:bg-slate-900 dark:text-slate-100">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <FileText className="h-5 w-5" />
                          </div>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            PDF
                          </span>
                        </div>
                        <div className="mt-8 space-y-2">
                          <div className="h-2 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
                          <div className="h-2 w-5/6 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <div className="h-2 w-2/3 rounded-full bg-slate-200 dark:bg-slate-700" />
                        </div>
                      </div>
                    </div>

                    <CardContent className="space-y-3 p-5">
                      <div>
                        <p className="line-clamp-2 text-base font-semibold leading-6 text-foreground">
                          {document.pdfFileName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">Updated {formatUpdatedAt(document.updatedAt)}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatBytes(document.size)}</span>
                        <span>Open editor</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}