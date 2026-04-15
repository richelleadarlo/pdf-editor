# 📄 Local-First PDF Editor

A browser-based PDF editor built with **React + Vite + Tailwind CSS** that allows users to upload, edit, and save PDFs directly on their device.

## 🚀 Overview

This project is a **local-first web application**, meaning all data is stored in the browser using `localStorage`. Once a PDF is uploaded, it is automatically saved and restored when the user revisits the app—no re-upload needed.

## ✨ Features

- 📥 Upload and render PDF files
- ✏️ Add and edit text overlays
- 🎨 Customize text (font size, font family, color)
- ✍️ Add signatures (draw or upload)
- 🖱️ Drag and resize elements
- 💾 Automatic saving using `localStorage`
- 🔄 Restore previous session on reload
- 📤 Export edited PDF

## 🧱 Tech Stack

- React (Vite)
- Tailwind CSS
- pdfjs-dist (PDF.js)
- pdf-lib
- localStorage

## ⚙️ Installation & Setup

1. Clone the repository:
git clone <your-repo-url>
cd pdf-editor

2. Install dependencies:
npm install

3. Start development server:
npm run dev

4. Open in browser:
http://localhost:5173

## 📁 Project Structure

src/
 ├── components/
 │   ├── PDFViewer.jsx
 │   ├── Toolbar.jsx
 │   ├── TextOverlay.jsx
 │   ├── SignaturePad.jsx
 │
 ├── hooks/
 ├── utils/
 ├── App.jsx
 ├── main.jsx

## 💾 How Local Storage Works

- The uploaded PDF is converted into a Base64 string and stored in localStorage.
- All edits (text, positions, styles, signatures) are stored as JSON.

Example:

{
  "pdfFile": "base64string",
  "edits": [
    {
      "type": "text",
      "content": "Hello",
      "x": 100,
      "y": 200,
      "fontSize": 16,
      "fontFamily": "Arial",
      "color": "#000000",
      "page": 1
    }
  ]
}

- On page load, the app checks localStorage and restores the previous session automatically.

## 🧠 Key Concept: Local-First Behavior

Once a PDF is uploaded:
- It is saved entirely in browser storage
- All edits are auto-saved
- Reopening the bookmarked page restores everything instantly

## 📤 Exporting PDFs

- Uses pdf-lib to merge:
  - Original PDF
  - Text overlays
  - Signature images
- Outputs a downloadable edited PDF

## ⚠️ Limitations

- Does NOT directly edit original PDF text (uses overlays instead)
- Large PDFs may exceed localStorage limits
- Best suited for small to medium-sized documents

## 🚀 Future Improvements

- Use IndexedDB for larger file storage
- Add undo/redo functionality
- Multi-page editing enhancements
- Zoom controls
- Dark mode
- Convert into a Progressive Web App (PWA)

## 📌 Notes

- This app runs entirely on the client-side
- No backend or database is used
- Works offline after initial load (if cached properly)

## 👩‍💻 Author

Developed as a modern, lightweight alternative to traditional PDF editors with a focus on privacy and offline usability.

---

Tip: Bookmark the app after uploading a PDF to experience its full local-first capability.