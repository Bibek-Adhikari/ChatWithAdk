/**
 * ConverterAdk — document conversion API.
 *
 * Everything here is real. Tools that need binaries this host does not have
 * (LibreOffice, Ghostscript, Poppler, a headless browser) are reported as
 * unavailable by GET /capabilities and return 503 with setup instructions
 * instead of pretending to convert.
 *
 * Nothing is written to disk: uploads live in memory for the duration of the
 * request and the result is streamed straight back. That removes the entire
 * temp-file cleanup / path-traversal / stale-download class of bugs.
 */
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const router = express.Router();

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file
const MAX_FILES = 30;
const REQUEST_TIMEOUT_MS = 60_000;

/* ────────────────────────────── errors ────────────────────────────── */

class ConversionError extends Error {
  constructor(status, message, code = 'conversion_failed') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fail = (status, message, code) => {
  throw new ConversionError(status, message, code);
};

/* ────────────────────────────── uploads ───────────────────────────── */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new ConversionError(415, `Unsupported file type: ${file.mimetype || 'unknown'}.`));
    }
    cb(null, true);
  },
});

/* ────────────────────────────── validation ────────────────────────── */

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

const assertPdf = (file) => {
  if (!file) fail(400, 'No PDF uploaded.', 'missing_file');
  if (!startsWith(file.buffer, [0x25, 0x50, 0x44, 0x46])) {
    // %PDF
    fail(415, `"${file.originalname}" is not a valid PDF (bad file signature).`, 'invalid_pdf');
  }
  // A structurally complete PDF ends with %%EOF. Without it, pdf-lib can walk
  // past the end of the buffer looking for objects, so reject it up front.
  if (file.buffer.lastIndexOf('%EOF') === -1) {
    fail(415, `"${file.originalname}" is incomplete or truncated.`, 'corrupt_pdf');
  }
};

const MAX_DIMENSION = 20_000;

/**
 * A bare 8-byte signature is not enough: a truncated PNG makes pdf-lib's chunk
 * reader loop forever, which freezes the whole Node process. Walk the chunk
 * table (with hard bounds) so only structurally complete images reach the
 * conversion engine.
 */
const validatePng = (buffer, name) => {
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let chunks = 0;

  while (offset + 8 <= buffer.length) {
    if (chunks++ > 10_000) fail(415, `"${name}" has too many PNG chunks to process safely.`, 'invalid_image');
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const next = offset + 12 + length;
    if (length > buffer.length || next > buffer.length) {
      fail(415, `"${name}" is a truncated PNG and cannot be converted.`, 'corrupt_image');
    }
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      sawHeader = true;
    }
    if (type === 'IEND') {
      if (!sawHeader) fail(415, `"${name}" is missing its PNG header.`, 'corrupt_image');
      if (!width || !height) fail(415, `"${name}" has no usable dimensions.`, 'corrupt_image');
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        fail(415, `"${name}" is ${width}×${height}px. The limit is ${MAX_DIMENSION}px per side.`, 'image_too_large');
      }
      return;
    }
    offset = next;
  }

  fail(415, `"${name}" is a truncated PNG and cannot be converted.`, 'corrupt_image');
};

const validateJpeg = (buffer, name) => {
  const tail = buffer.subarray(Math.max(0, buffer.length - 4096));
  if (tail.lastIndexOf(Buffer.from([0xff, 0xd9])) === -1) {
    fail(415, `"${name}" is a truncated JPEG and cannot be converted.`, 'corrupt_image');
  }

  // Scan the segment table for a frame header to read the dimensions.
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (!width || !height) fail(415, `"${name}" has no usable dimensions.`, 'corrupt_image');
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        fail(415, `"${name}" is ${width}×${height}px. The limit is ${MAX_DIMENSION}px per side.`, 'image_too_large');
      }
      return;
    }
    offset += 2 + length;
  }
};

const assertImage = (file) => {
  if (!file) fail(400, 'No image uploaded.', 'missing_file');
  const isJpeg = startsWith(file.buffer, [0xff, 0xd8, 0xff]);
  const isPng = startsWith(file.buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!isJpeg && !isPng) {
    fail(415, `"${file.originalname}" is not a valid JPG or PNG (bad file signature).`, 'invalid_image');
  }
  if (isPng) validatePng(file.buffer, file.originalname);
  else validateJpeg(file.buffer, file.originalname);
};

const safeBase = (name, fallback = 'document') => {
  const base = path.basename(String(name || fallback)).replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[^a-zA-Z0-9._ -]/g, '').trim().slice(0, 80);
  return cleaned || fallback;
};

const ascii = (value) => /^[\x20-\x7E]*$/.test(value);

const parsePages = (spec, total) => {
  if (!spec || !String(spec).trim()) fail(400, 'Enter at least one page number.', 'missing_pages');
  const pages = new Set();
  for (const raw of String(spec).split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) fail(400, `Invalid page selection "${part}". Use formats like 1, 3-5.`, 'invalid_pages');
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    if (from < 1 || to < 1 || from > total || to > total) {
      fail(400, `Page "${part}" is outside this document (1–${total}).`, 'invalid_pages');
    }
    if (from > to) fail(400, `Range "${part}" is reversed.`, 'invalid_pages');
    for (let p = from; p <= to; p += 1) pages.add(p);
  }
  const list = [...pages].sort((a, b) => a - b);
  if (!list.length) fail(400, 'Enter at least one page number.', 'missing_pages');
  return list;
};

const loadPdf = async (file) => {
  assertPdf(file);
  try {
    return await PDFDocument.load(file.buffer, {
      updateMetadata: false,
      ignoreEncryption: false,
    });
  } catch (error) {
    const encrypted = /encrypt/i.test(error?.message || '');
    if (encrypted) {
      fail(422, 'This PDF is password-protected. Remove the password first, then try again.', 'encrypted_pdf');
    }
    fail(422, `"${file.originalname}" could not be read as a PDF. The file may be corrupted.`, 'corrupt_pdf');
  }
  return null;
};

/* ────────────────────────────── responses ─────────────────────────── */

const sendPdf = (res, bytes, filename, headers = {}) => {
  const buffer = Buffer.from(bytes);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, String(value));
  res.status(200).send(buffer);
};

const sendZip = async (res, entries, filename) => {
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.name, entry.bytes);
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', bytes.length);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(bytes);
};

/* ────────────────────────────── rate limit ────────────────────────── */

const buckets = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 40;

const rateLimit = (req, res, next) => {
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_REQUESTS) {
    const retry = Math.ceil((WINDOW_MS - (now - hits[0])) / 1000);
    res.setHeader('Retry-After', retry);
    return res.status(429).json({
      error: 'Too many conversions from this connection. Please wait a few minutes.',
      code: 'rate_limited',
    });
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return next();
};

router.use(rateLimit);

/* ────────────────────────────── engines ───────────────────────────── */

const findBinary = (names, extraPaths = []) => {
  const exts = process.platform === 'win32' ? ['', '.exe', '.bat'] : [''];
  for (const candidate of extraPaths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const name of names) {
      for (const ext of exts) {
        const full = path.join(dir, `${name}${ext}`);
        try {
          if (fs.existsSync(full)) return full;
        } catch {
          /* ignore unreadable PATH entries */
        }
      }
    }
  }
  return null;
};

const libreOfficePath = () =>
  findBinary(['soffice', 'libreoffice'], [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice',
    '/usr/lib/libreoffice/program/soffice',
  ]);

const ghostscriptPath = () =>
  findBinary(['gswin64c', 'gswin32c', 'gs'], [
    'C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe',
    '/usr/bin/gs',
    '/opt/homebrew/bin/gs',
  ]);

const engines = () => ({
  libreoffice: Boolean(libreOfficePath()),
  ghostscript: Boolean(ghostscriptPath()),
});

/* ────────────────────────────── capabilities ──────────────────────── */

const SYSTEM_REQUIREMENT = 'Needs LibreOffice on the server (SOFFICE_PATH) — not installed here.';

export const TOOL_CAPABILITIES = () => {
  const { libreoffice, ghostscript } = engines();
  const office = libreoffice
    ? 'ready'
    : { state: 'unavailable', reason: SYSTEM_REQUIREMENT, setup: 'Install LibreOffice and restart the API.' };

  return {
    engines: { libreoffice, ghostscript },
    runtime: 'server',
    tools: {
      'jpg-to-pdf': { state: 'ready' },
      'word-to-pdf': office,
      'powerpoint-to-pdf': office,
      'excel-to-pdf': office,
      'html-to-pdf': {
        state: 'unavailable',
        reason: 'Needs LibreOffice plus a sandboxed headless browser for URL input.',
        setup: 'Install LibreOffice and Chromium, then enable the HTML pipeline.',
      },
      'pdf-to-jpg': { state: 'ready', runtime: 'client' },
      'pdf-to-word': {
        state: 'unavailable',
        reason: 'Needs a PDF text-layout engine (pdf2docx) — not installed here.',
      },
      'pdf-to-powerpoint': {
        state: 'unavailable',
        reason: 'Needs Poppler for page rasterisation — not installed here.',
      },
      'pdf-to-excel': {
        state: 'unavailable',
        reason: 'Needs a table-extraction engine (Camelot/Tabula) — not installed here.',
      },
      'pdf-to-pdfa': {
        state: 'unavailable',
        reason: 'Needs Ghostscript plus veraPDF to validate. We never label a file PDF/A without validation.',
      },
      'merge-pdf': { state: 'ready' },
      'split-pdf': { state: 'ready' },
      'extract-pages': { state: 'ready' },
      'delete-pages': { state: 'ready' },
      'rotate-pdf': { state: 'ready' },
      'reorder-pages': { state: 'ready' },
      'compress-pdf': {
        state: 'unavailable',
        reason: 'Real compression needs Ghostscript; re-saving alone would inflate your file.',
      },
      'add-page-numbers': { state: 'ready' },
      'text-watermark': { state: 'ready' },
      'password-protect': {
        state: 'unavailable',
        reason: 'PDF encryption needs qpdf or muhammara — not installed here.',
      },
      'unlock-pdf': {
        state: 'unavailable',
        reason: 'Removing passwords needs qpdf and proof of authorisation.',
      },
      'extract-text': {
        state: 'unavailable',
        reason: 'Text extraction needs a PDF parsing engine — not installed here.',
      },
      'ocr-pdf': {
        state: 'unavailable',
        reason: 'OCR needs Tesseract plus rasterisation — not installed here.',
      },
    },
  };
};

router.get('/capabilities', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(TOOL_CAPABILITIES());
});

/* ────────────────────────────── helpers ───────────────────────────── */

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
};

const go = (handler) => async (req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        error: 'That conversion took too long and was stopped. Try a smaller file.',
        code: 'timeout',
      });
    }
  }, REQUEST_TIMEOUT_MS);

  try {
    await handler(req, res);
  } catch (error) {
    if (res.headersSent) return;
    next(error);
  } finally {
    clearTimeout(timer);
  }
};

/* ────────────────────────── convert to PDF ────────────────────────── */

router.post(
  '/image-to-pdf',
  upload.array('files', MAX_FILES),
  go(async (req, res) => {
    const files = req.files || [];
    if (!files.length) fail(400, 'Add at least one image.', 'missing_file');
    files.forEach(assertImage);

    const pageSize = String(req.body.pageSize || 'a4').toLowerCase();
    const orientation = String(req.body.orientation || 'portrait').toLowerCase();
    const fit = String(req.body.fit || 'contain').toLowerCase();
    const margin = Math.min(72, Math.max(0, Number(req.body.margin) || 0));

    const doc = await PDFDocument.create();

    for (const file of files) {
      const isPng = startsWith(file.buffer, [0x89, 0x50, 0x4e, 0x47]);
      const image = isPng ? await doc.embedPng(file.buffer) : await doc.embedJpg(file.buffer);

      let pageWidth;
      let pageHeight;
      if (pageSize === 'original') {
        pageWidth = image.width;
        pageHeight = image.height;
      } else {
        [pageWidth, pageHeight] = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
        if (orientation === 'landscape') [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }

      const page = doc.addPage([pageWidth, pageHeight]);
      const boxWidth = Math.max(1, pageWidth - margin * 2);
      const boxHeight = Math.max(1, pageHeight - margin * 2);

      let drawWidth = boxWidth;
      let drawHeight = boxHeight;
      if (fit !== 'stretch') {
        const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
        drawWidth = image.width * scale;
        drawHeight = image.height * scale;
      }

      page.drawImage(image, {
        x: (pageWidth - drawWidth) / 2,
        y: (pageHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
      });
    }

    doc.setProducer('ConverterAdk');
    const bytes = await doc.save();
    const name = files.length === 1 ? `${safeBase(files[0].originalname, 'image')}.pdf` : 'converteradk-images.pdf';
    sendPdf(res, bytes, name, { 'X-Page-Count': doc.getPageCount() });
  })
);

/* ───────────────────────────── organize ──────────────────────────── */

router.post(
  '/merge',
  upload.array('files', MAX_FILES),
  go(async (req, res) => {
    const files = req.files || [];
    if (files.length < 2) fail(400, 'Select at least two PDFs to merge.', 'missing_file');
    const merged = await PDFDocument.create();

    for (const file of files) {
      const source = await loadPdf(file);
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }

    merged.setProducer('ConverterAdk');
    const bytes = await merged.save();
    sendPdf(res, bytes, 'converteradk-merged.pdf', { 'X-Page-Count': merged.getPageCount() });
  })
);

router.post(
  '/split',
  upload.single('file'),
  go(async (req, res) => {
    const source = await loadPdf(req.file);
    const total = source.getPageCount();
    const mode = String(req.body.mode || 'each').toLowerCase();
    const base = safeBase(req.file.originalname, 'document');
    const entries = [];

    if (mode === 'ranges') {
      const groups = String(req.body.ranges || '')
        .split(/[\n;]/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!groups.length) fail(400, 'Add at least one range, for example 1-3.', 'missing_pages');
      for (const group of groups) {
        const selected = parsePages(group, total);
        const out = await PDFDocument.create();
        const pages = await out.copyPages(source, selected.map((p) => p - 1));
        pages.forEach((page) => out.addPage(page));
        entries.push({
          name: `${base}-${group.replace(/[^0-9,-]/g, '')}.pdf`,
          bytes: await out.save(),
        });
      }
    } else {
      for (let i = 0; i < total; i += 1) {
        const out = await PDFDocument.create();
        const [page] = await out.copyPages(source, [i]);
        out.addPage(page);
        entries.push({
          name: `${base}-page-${String(i + 1).padStart(2, '0')}.pdf`,
          bytes: await out.save(),
        });
      }
    }

    await sendZip(res, entries, `${base}-split.zip`);
  })
);

router.post(
  '/extract-pages',
  upload.single('file'),
  go(async (req, res) => {
    const source = await loadPdf(req.file);
    const selected = parsePages(req.body.pages, source.getPageCount());
    const out = await PDFDocument.create();
    const pages = await out.copyPages(source, selected.map((p) => p - 1));
    pages.forEach((page) => out.addPage(page));
    const bytes = await out.save();
    sendPdf(res, bytes, `${safeBase(req.file.originalname)}-pages.pdf`, { 'X-Page-Count': out.getPageCount() });
  })
);

router.post(
  '/delete-pages',
  upload.single('file'),
  go(async (req, res) => {
    const source = await loadPdf(req.file);
    const total = source.getPageCount();
    const remove = new Set(parsePages(req.body.pages, total));
    const keep = [];
    for (let i = 0; i < total; i += 1) if (!remove.has(i + 1)) keep.push(i);
    if (!keep.length) fail(400, 'You cannot delete every page.', 'empty_document');

    const out = await PDFDocument.create();
    const pages = await out.copyPages(source, keep);
    pages.forEach((page) => out.addPage(page));
    const bytes = await out.save();
    sendPdf(res, bytes, `${safeBase(req.file.originalname)}-edited.pdf`, { 'X-Page-Count': out.getPageCount() });
  })
);

router.post(
  '/rotate',
  upload.single('file'),
  go(async (req, res) => {
    const source = await loadPdf(req.file);
    const total = source.getPageCount();
    const angle = Number(req.body.angle);
    if (![90, 180, 270, -90].includes(angle)) fail(400, 'Rotation must be 90, 180 or 270 degrees.', 'invalid_angle');
    const targets = new Set(
      String(req.body.pages || '').trim() ? parsePages(req.body.pages, total) : Array.from({ length: total }, (_, i) => i + 1)
    );

    source.getPages().forEach((page, index) => {
      if (!targets.has(index + 1)) return;
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees(((current + angle) % 360 + 360) % 360));
    });

    const bytes = await source.save();
    sendPdf(res, bytes, `${safeBase(req.file.originalname)}-rotated.pdf`, { 'X-Page-Count': total });
  })
);

router.post(
  '/reorder-pages',
  upload.single('file'),
  go(async (req, res) => {
    const source = await loadPdf(req.file);
    const total = source.getPageCount();
    const order = String(req.body.order || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (order.length !== total) {
      fail(400, `Enter all ${total} page numbers, in the order you want them.`, 'invalid_order');
    }
    if (new Set(order).size !== total || order.some((page) => page > total)) {
      fail(400, `Use each page number from 1 to ${total} exactly once.`, 'invalid_order');
    }

    const out = await PDFDocument.create();
    const pages = await out.copyPages(source, order.map((page) => page - 1));
    pages.forEach((page) => out.addPage(page));
    const bytes = await out.save();
    sendPdf(res, bytes, `${safeBase(req.file.originalname)}-reordered.pdf`, { 'X-Page-Count': total });
  })
);

/* ────────────────────────── edit & secure ────────────────────────── */

router.post(
  '/page-numbers',
  upload.single('file'),
  go(async (req, res) => {
    const doc = await loadPdf(req.file);
    const total = doc.getPageCount();
    const position = String(req.body.position || 'bottom-center');
    const startAt = Math.max(0, Number(req.body.startAt) || 1);
    const format = String(req.body.format || 'n') === 'page-n-of-total' ? 'page-n-of-total' : 'n';
    const fontSize = Math.min(36, Math.max(6, Number(req.body.fontSize) || 10));
    const font = await doc.embedFont(StandardFonts.Helvetica);

    doc.getPages().forEach((page, index) => {
      const number = index + startAt;
      const text = format === 'page-n-of-total' ? `Page ${number} of ${total}` : String(number);
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const margin = 24;
      let x = (width - textWidth) / 2;
      let y = margin;
      if (position.includes('left')) x = margin;
      if (position.includes('right')) x = width - textWidth - margin;
      if (position.startsWith('top')) y = height - margin - fontSize;
      page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.28, 0.3, 0.35) });
    });

    const bytes = await doc.save();
    sendPdf(res, bytes, `${safeBase(req.file.originalname)}-numbered.pdf`, { 'X-Page-Count': total });
  })
);

router.post(
  '/watermark',
  upload.single('file'),
  go(async (req, res) => {
    const text = String(req.body.text || '').trim();
    if (!text) fail(400, 'Enter the watermark text.', 'missing_text');
    if (!ascii(text)) {
      fail(400, 'Watermark text must use Latin characters (A–Z, 0–9, punctuation).', 'unsupported_characters');
    }

    const doc = await loadPdf(req.file);
    const total = doc.getPageCount();
    const opacity = Math.min(1, Math.max(0.05, Number(req.body.opacity) || 0.15));
    const size = Math.min(120, Math.max(12, Number(req.body.fontSize) || 52));
    const font = await doc.embedFont(StandardFonts.HelveticaBold);

    doc.getPages().forEach((page) => {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, size);
      page.drawText(text, {
        x: width / 2 - (textWidth / 2) * Math.cos(Math.PI / 4),
        y: height / 2 - (textWidth / 2) * Math.sin(Math.PI / 4) - size / 2,
        size,
        font,
        color: rgb(0.55, 0.36, 0.96),
        opacity,
        rotate: degrees(45),
      });
    });

    const bytes = await doc.save();
    sendPdf(res, bytes, `${safeBase(req.file.originalname)}-watermarked.pdf`, { 'X-Page-Count': total });
  })
);

/* ─────────────────────────────── info ────────────────────────────── */

router.post(
  '/info',
  upload.single('file'),
  go(async (req, res) => {
    const doc = await loadPdf(req.file);
    const pages = doc.getPages();
    const first = pages[0]?.getSize();
    res.json({
      pages: pages.length,
      title: doc.getTitle() || null,
      author: doc.getAuthor() || null,
      producer: doc.getProducer() || null,
      size: req.file.size,
      pageSize: first ? { width: Math.round(first.width), height: Math.round(first.height) } : null,
    });
  })
);

/* ───────────────────── unavailable (honest 503s) ─────────────────── */

const UNAVAILABLE = {
  'word-to-pdf': SYSTEM_REQUIREMENT,
  'powerpoint-to-pdf': SYSTEM_REQUIREMENT,
  'excel-to-pdf': SYSTEM_REQUIREMENT,
  'html-to-pdf': 'Needs LibreOffice plus a sandboxed headless browser.',
  'pdf-to-word': 'Needs a PDF text-layout engine (pdf2docx) on the server.',
  'pdf-to-powerpoint': 'Needs Poppler to rasterise pages on the server.',
  'pdf-to-excel': 'Needs a table-extraction engine (Camelot/Tabula) on the server.',
  'pdf-to-pdfa': 'Needs Ghostscript and veraPDF. We do not label PDFs as PDF/A without validation.',
  'compress-pdf': 'Real compression needs Ghostscript on the server.',
  'password-protect': 'PDF encryption needs qpdf on the server.',
  'unlock-pdf': 'Password removal needs qpdf and authorisation checks.',
  'extract-text': 'Text extraction needs a PDF parsing engine on the server.',
  'ocr-pdf': 'OCR needs Tesseract on the server.',
};

router.post(['/word-to-pdf', '/powerpoint-to-pdf', '/excel-to-pdf', '/html-to-pdf'], (req, res) => {
  res.status(503).json({
    error: UNAVAILABLE['word-to-pdf'],
    code: 'engine_unavailable',
    setup: 'Install LibreOffice, set SOFFICE_PATH, then restart the API.',
    requested: req.path.replace('/', ''),
  });
});

router.post(
  [
    '/pdf-to-word',
    '/pdf-to-powerpoint',
    '/pdf-to-excel',
    '/pdf-to-pdfa',
    '/compress-pdf',
    '/password-protect',
    '/unlock-pdf',
    '/extract-text',
    '/ocr-pdf',
  ],
  (req, res) => {
    const key = req.path.replace('/', '');
    res.status(503).json({
      error: UNAVAILABLE[key] || 'This tool is not available on this server.',
      code: 'engine_unavailable',
      requested: key,
    });
  }
);

/* ────────────────────────────── errors ───────────────────────────── */

router.use((error, _req, res, _next) => {
  if (res.headersSent) return;

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `Each file must be ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB or smaller.`
        : error.code === 'LIMIT_FILE_COUNT'
          ? `You can upload up to ${MAX_FILES} files at once.`
          : 'The upload could not be processed.';
    return res.status(413).json({ error: message, code: error.code });
  }

  if (error instanceof ConversionError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }

  console.error('[converter] unexpected error:', error);
  return res.status(500).json({
    error: 'Something went wrong while converting that file. Please try again.',
    code: 'internal_error',
  });
});

export default router;
