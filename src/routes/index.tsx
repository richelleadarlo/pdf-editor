import { createFileRoute } from "@tanstack/react-router";
import { PDFEditor } from "@/components/PDFEditor";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "PDF Editor — Edit PDFs in Your Browser" },
      { name: "description", content: "A local-first PDF editor. Add text, signatures, and export — all in your browser with no uploads." },
    ],
  }),
});

function Index() {
  return <PDFEditor />;
}
