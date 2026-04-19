import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/App";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "PDF Editor - Local First PDF Workspace" },
      {
        name: "description",
        content:
          "Upload PDFs locally, edit detected text inline, use undo and redo, and install the app for offline work.",
      },
    ],
  }),
});

function Index() {
  return <App />;
}
