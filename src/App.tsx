import { PDFEditor } from "@/components/PDFEditor";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  return (
    <>
      <PDFEditor />
      <Toaster richColors closeButton position="bottom-right" />
    </>
  );
}
