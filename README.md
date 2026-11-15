# PDF Studio

PDF Studio is a local browser app for working with PDFs. It includes the 29 tools listed in Project 1 of the Week 2 brief. PDF processing happens in the browser on this device; the included server binds only to `127.0.0.1` and serves the app files. All required JavaScript libraries are included in `vendor` for offline use.

## Open PDF Studio on Windows

1. Keep the `PDF Studio` folder together.
2. Double-click `start.bat`.
3. Leave the terminal window open. It prints the local address to open in Chrome or another browser. If port 4173 is already occupied, the server tries the next available local port.
4. To stop PDF Studio, press Ctrl+C in the terminal window.

Use harmless sample PDFs when trying the tools. The source PDF files are not modified by the app; use **Save PDF** or a tool's export button to download a new file.

## Scope and notes

- Organise: merge, split, reorder, rotate, delete, duplicate, extract pages, insert blank pages, and crop.
- Edit: add text or images, highlight, draw, add shapes, whiteout, permanently redact, sign with typed text, and fill existing form fields.
- Stamp: watermark, page numbers, header, footer, and date.
- Convert: images to PDF, PDF pages to PNG images in a ZIP, and selectable PDF text to a text file.
- Finish: compress, edit or remove PDF details, and compare page counts and selectable text.
- PDF-to-text does not perform OCR on scanned pages. Text comparison does not detect visual-only changes. Redaction rasterizes the affected page so the covered text is no longer selectable or searchable.
- Compression uses a rasterized copy only when it is smaller than the current PDF; that compressed output may no longer have selectable text. Otherwise the app saves the current PDF unchanged and reports the before/after sizes.
- Prompts and the testing checklist are recorded in `prompts.md`.
