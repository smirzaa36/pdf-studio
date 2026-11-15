# Build prompts

## Plan — Project 1, PDF Studio

Use the Week 2 PDF as the only feature source. Build the browser app in this `PDF Studio` folder and include its PDF libraries locally. Process input files in the browser; keep the local server on the loopback address. Implement the groups in the PDF order: Organise, Edit, Stamp, Convert, Finish. Save each prompt below in order. Test with harmless generated PDFs, including a 50-page file, and check the four Project 1 “Done when” requirements: offline work across all five groups, opening the saved output in another PDF reader, non-searchable redaction, and before/after compression sizes. Do not implement the optional password lock or OCR.

## Prompt 1 — PDF Studio first increment

Build Project 1, PDF Studio, from the BSERC Week 2 Projects brief. Follow the brief's plan, prompt, build, test, improve workflow. Make a web app that runs locally in my browser on Windows and processes PDFs on this device without uploading them or needing internet. For the first increment, implement merging multiple PDF files, arranging all pages, and saving a new PDF. Show page previews. Let me reorder pages by both dragging thumbnails and using move-up/move-down buttons. Suggest an editable output filename such as `merged.pdf`. Leave source PDFs untouched. Keep the interface clear, attractive, and usable on a phone. Include any libraries needed for offline operation in the project. We will add more feature groups in later prompts, one group at a time.

## Prompt 2 — Split PDFs by page ranges

Continue Project 1 by adding range-based splitting. Let me enter one or more comma-separated page ranges, using the page order currently displayed. Create one PDF per range, put those PDFs into a ZIP, and let me choose the ZIP filename. Reject invalid or overlapping ranges with a clear message. Keep processing local and leave the input PDFs unchanged.

## Prompt 3 — Complete Organise tools

Continue Project 1 and complete the Organise tools from the brief. In the page list, support rotating pages, deleting a page, duplicating a page, inserting blank pages, cropping individual pages, and extracting selected page ranges into one PDF. Apply page edits when merging, splitting, extracting, and saving. Keep source files unchanged and all processing local. Use clear page-level controls and retain both drag-and-drop and arrow-button reordering.

## Prompt 4 — Complete Edit tools

Continue Project 1, PDF Studio. Complete all Edit tools in the brief: add text, add an image, highlight, draw, shapes, whiteout, permanent redaction, sign, and fill existing PDF form fields. Apply changes to the selected page in the saved output, keep source files unchanged, and process everything locally. Make it clear that redaction is permanent and ensure redacted content is rasterized so its text cannot be selected or searched. Keep the controls clear and usable.

## Prompt 5 — Complete Stamp tools

Continue Project 1, PDF Studio. Complete the Stamp tools in the brief: watermark, page numbers, header, footer, and date stamp. Let me set and clear stamp settings, apply them to the output PDF, and keep all work local. Do not alter source PDFs.

## Prompt 6 — Complete Convert tools

Continue Project 1, PDF Studio. Complete the Convert tools in the brief: convert multiple images to PDF, export PDF pages as images, and extract selectable PDF text to a text file. Process the current page order and current edits where applicable, run entirely offline, and explain that scanned pages without text need OCR.

## Prompt 7 — Complete Finish tools

Continue Project 1, PDF Studio. Complete the Finish tools in the brief: compress and save a PDF while showing file size before and after, edit PDF details, remove PDF details, and compare two PDFs. Compare page counts and selectable text locally, and state the comparison limit for visual-only changes. Keep all operations local and leave source files unchanged.

## Prompt 8 — Test the brief's Done when list

Test PDF Studio against Project 1's Done when list using a harmless generated 50-page PDF and Wi-Fi off: exercise tools from Organise, Edit, Stamp, Convert, and Finish; save the result and open it in another PDF reader; verify permanently redacted text is neither selectable nor searchable; and confirm compression reports before and after sizes. Record each check and any limitation. Fix any failure, then repeat the check.

## Prompt 9 — Improve startup and reliability

Fix issues discovered during startup and testing without adding features beyond Project 1. Ensure every navigation group initializes without a missing-function error, keep the browser app local-only, and make the local server choose the next available loopback port if its default is occupied. Update the run instructions and recheck all five tool groups.

## Test results and improvement record

- `node --check app.js` and `node --check server.mjs`: passed.
- Local server smoke check: HTML, app JavaScript, CSS, and all three bundled PDF/ZIP libraries returned HTTP 200 on loopback. The default port was occupied; the server selected 4175 after earlier ports were also occupied.
- Harmless 50-page PDF fixture: generated and reopened successfully with PDF-Lib. Temporary fixture and test script were removed.
- Browser-driven app interaction, Wi-Fi-off operation, saved output in a second PDF reader, redaction searchability, and compression size display: not verified in this run. Browser automation was unavailable (the Windows computer-use host stayed busy; launching headless Chrome was rejected by the workspace sandbox policy). These remain manual checks from the Done when list.
- Improvement made from the smoke check: fixed a local server request path using an undefined port variable and added clearer local request errors. The unavailable browser run also exposed the need to check the actual app output manually; syntax and server smoke checks alone do not establish that full workflow.
