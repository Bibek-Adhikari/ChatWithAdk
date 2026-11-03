# ConverterAdk

All your PDF tools in one place — the document toolkit inside Tufan.

- **UI:** `components/ConverterAdk/` — dashboard, tool registry, universal uploader, workbench.
- **API:** `server/routes/converter.js`, mounted at `/api/converter`.
- **Route:** `/converteradk` (deep link to a tool with `#tool-id`, e.g. `/converteradk#merge-pdf`).

## What actually works today

Everything listed as **Ready** in the UI performs a real conversion. No button is decorative.

| Tool | Endpoint | Engine |
| --- | --- | --- |
| JPG / PNG → PDF | `POST /api/converter/image-to-pdf` | `pdf-lib` |
| Merge PDF | `POST /api/converter/merge` | `pdf-lib` |
| Split PDF | `POST /api/converter/split` | `pdf-lib` + `jszip` |
| Extract pages | `POST /api/converter/extract-pages` | `pdf-lib` |
| Delete pages | `POST /api/converter/delete-pages` | `pdf-lib` |
| Rotate PDF | `POST /api/converter/rotate` | `pdf-lib` |
| Reorder pages | `POST /api/converter/reorder-pages` | `pdf-lib` |
| Add page numbers | `POST /api/converter/page-numbers` | `pdf-lib` |
| Text watermark | `POST /api/converter/watermark` | `pdf-lib` |
| PDF → JPG | browser only | `pdfjs-dist` (rendered locally, the PDF is never uploaded) |

All endpoints stream the result back with `Content-Disposition`. **Nothing is written to disk**, so there are no
temp files to clean up, no download IDs to expire and no path traversal surface.

`GET /api/converter/capabilities` reports what the running server can actually do. The UI merges that response
into the tool registry, so a tool the server cannot run is shown as _Coming soon_ with the server's reason
instead of failing after upload.

## What is intentionally switched off

These tools exist in the registry, are visibly disabled, and their endpoints return **503** with a reason
(never a fake success):

| Tool | Missing dependency |
| --- | --- |
| Word / PowerPoint / Excel → PDF | LibreOffice (`soffice`) |
| HTML → PDF | LibreOffice + a sandboxed headless browser |
| PDF → Word | `pdf2docx` |
| PDF → PowerPoint | Poppler (`pdftoppm`) |
| PDF → Excel | Camelot / Tabula |
| PDF → PDF/A | Ghostscript + veraPDF (validation is mandatory before labelling a file PDF/A) |
| Compress PDF | Ghostscript |
| Password protect / Unlock | `qpdf` or `muhammara` |
| Extract text / OCR | A PDF text engine / Tesseract |

### Enabling them later

Install the binary and restart the API — `GET /capabilities` detects it automatically:

1. **LibreOffice** — install it, then set `SOFFICE_PATH` if it is not on `PATH`.
   The server already probes the usual Windows and Unix locations.
2. **Ghostscript** — install it for compression, PDF/A and rasterisation.
3. **qpdf** — for encryption and decryption.
4. Then implement the corresponding route in `server/routes/converter.js` and flip its capability entry
   to `{ state: 'ready' }`.

Do not flip a capability to `ready` before the route works — the UI trusts this map.

## Limits and validation

- 20 MB per file, 30 files per request, 60 s conversion budget.
- Rate limit: 40 conversions / 10 minutes / IP.
- File **signatures** are checked (`%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47`), not just extensions or MIME types.
- Encrypted PDFs are rejected with a clear message.
- Page ranges are validated against the real page count (`1-3, 5, 8`, 1-based).
- Page numbers and watermarks use the PDF standard fonts, so watermark text is limited to Latin characters
  (the UI says so before you run it).
- Error responses are `{ error, code }` — no stack traces, paths or internal details.

## Adding a tool

1. Add an entry to `CONVERTER_TOOLS` in `components/ConverterAdk/tools.ts`. If it needs no custom UI, give it a
   `workflow` (endpoint, accepted files, option fields) and the generic workbench handles upload → options →
   progress → result.
2. Add the matching route in `server/routes/converter.js`.
3. Add its id to `TOOL_CAPABILITIES()` with `{ state: 'ready' }`.
4. If it needs bespoke UI (like PDF → JPG), add a component and branch to it in `ConverterAdk.tsx`.

## Environment

`VITE_API_BASE_URL` must point at the deployed API origin in production (for example
`https://bibekadk-chatadk.hf.space`). When it is empty the client calls same-origin `/api/converter/*`.
