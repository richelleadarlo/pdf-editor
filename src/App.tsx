import { DocumentLibrary } from "@/components/DocumentLibrary";
import { PDFEditor } from "@/components/PDFEditor";
import { Toaster } from "@/components/ui/sonner";
import { usePdfStorage } from "@/hooks/use-pdf-storage";

export function App() {
  const pdfStorage = usePdfStorage();

  if (!pdfStorage.hasLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
      </div>
    );
  }

  return (
    <>
      {pdfStorage.activeDocumentId ? (
        <PDFEditor storage={pdfStorage} />
      ) : (
        <DocumentLibrary
          documents={pdfStorage.documents}
          isLoading={pdfStorage.isLoading}
          onUploadFiles={pdfStorage.uploadPdfs}
          onOpenDocument={pdfStorage.openDocument}
          onDeleteDocument={pdfStorage.deleteDocument}
          onRenameDocument={pdfStorage.renameDocument}
        />
      )}
      <Toaster richColors closeButton position="bottom-right" />
    </>
  );
}
