// Integration test for the ConverterAdk API. Run with: node scripts/test-converter.mjs [baseUrl]
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://127.0.0.1:5099';

const makePdf = async (label) => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i += 1) {
    const page = doc.addPage([300, 400]);
    page.drawText(`${label} page ${i + 1}`, { x: 30, y: 340, size: 16, font, color: rgb(0, 0, 0) });
  }
  return new Uint8Array(await doc.save());
};

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const post = async (path, form) => {
  const response = await fetch(`${BASE}/api/converter${path}`, { method: 'POST', body: form });
  const buffer = Buffer.from(await response.arrayBuffer());
  let json = null;
  try {
    json = JSON.parse(buffer.toString('utf8'));
  } catch {
    /* binary */
  }
  return { response, buffer, json };
};

const pdfForm = async (extra = {}) => {
  const form = new FormData();
  form.append('file', new Blob([await makePdf('Doc')], { type: 'application/pdf' }), 'doc.pdf');
  for (const [key, value] of Object.entries(extra)) form.append(key, String(value));
  return form;
};

const run = async () => {
  // capabilities
  const caps = await fetch(`${BASE}/api/converter/capabilities`).then((r) => r.json());
  check('capabilities reports ready tools', caps.tools['jpg-to-pdf']?.state === 'ready');
  check('capabilities reports office engines honestly', caps.engines.libreoffice === false);

  // image -> pdf
  const imgForm = new FormData();
  imgForm.append('files', new Blob([PNG], { type: 'image/png' }), 'pixel.png');
  imgForm.append('pageSize', 'a4');
  imgForm.append('fit', 'contain');
  const imagePdf = await post('/image-to-pdf', imgForm);
  check(
    'PNG -> PDF returns a real PDF',
    imagePdf.response.status === 200 && imagePdf.buffer.subarray(0, 4).toString() === '%PDF',
    `${imagePdf.buffer.length} bytes, page=${imagePdf.response.headers.get('x-page-count')}`
  );

  // bad signature
  const fakeForm = new FormData();
  fakeForm.append('files', new Blob([Buffer.from('not an image')], { type: 'image/png' }), 'fake.png');
  const fake = await post('/image-to-pdf', fakeForm);
  check('fake PNG rejected by signature', fake.response.status === 415 && fake.json?.code === 'invalid_image');

  // structurally truncated PNG (valid signature, no IEND) — this used to hang the
  // PDF engine, so it must be rejected quickly rather than parsed.
  const truncated = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d]),
    Buffer.from('IHDR'),
    Buffer.from([0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, 0x08, 0x06, 0x00, 0x00, 0x00]),
  ]);
  const truncatedForm = new FormData();
  truncatedForm.append('files', new Blob([truncated], { type: 'image/png' }), 'truncated.png');
  const truncatedStart = Date.now();
  const truncatedResult = await post('/image-to-pdf', truncatedForm);
  check(
    'truncated PNG rejected fast instead of hanging',
    truncatedResult.response.status === 415 && truncatedResult.json?.code === 'corrupt_image',
    `${Date.now() - truncatedStart}ms`
  );

  // truncated PDF (no %%EOF)
  const truncatedPdf = new FormData();
  truncatedPdf.append(
    'file',
    new Blob([Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')], { type: 'application/pdf' }),
    'broken.pdf'
  );
  const brokenPdf = await post('/extract-pages', truncatedPdf);
  check('truncated PDF rejected', brokenPdf.response.status === 415 && brokenPdf.json?.code === 'corrupt_pdf');

  // merge
  const mergeForm = new FormData();
  mergeForm.append('files', new Blob([await makePdf('A')], { type: 'application/pdf' }), 'a.pdf');
  mergeForm.append('files', new Blob([await makePdf('B')], { type: 'application/pdf' }), 'b.pdf');
  const merged = await post('/merge', mergeForm);
  const mergedDoc = merged.response.ok ? await PDFDocument.load(merged.buffer) : null;
  check(
    'merge produces 6 pages from two 3-page PDFs',
    merged.response.status === 200 && mergedDoc?.getPageCount() === 6,
    `pages=${mergedDoc?.getPageCount()}`
  );

  // rotate
  const rotated = await post('/rotate', await pdfForm({ angle: 90 }));
  check('rotate returns 200', rotated.response.status === 200);

  // extract with bad page
  const badExtract = await post('/extract-pages', await pdfForm({ pages: '99' }));
  check('out-of-range page rejected', badExtract.response.status === 400 && badExtract.json?.code === 'invalid_pages');

  // extract valid
  const extract = await post('/extract-pages', await pdfForm({ pages: '1,3' }));
  const extracted = extract.response.ok ? await PDFDocument.load(extract.buffer) : null;
  check('extract keeps exactly the selected pages', extracted?.getPageCount() === 2);

  // delete pages
  const deleted = await post('/delete-pages', await pdfForm({ pages: '2' }));
  const deletedDoc = deleted.response.ok ? await PDFDocument.load(deleted.buffer) : null;
  check('delete removes one page', deletedDoc?.getPageCount() === 2);

  // split -> zip
  const split = await post('/split', await pdfForm({ mode: 'each' }));
  check(
    'split returns a ZIP',
    split.response.status === 200 && split.buffer.subarray(0, 2).toString() === 'PK',
    `${split.buffer.length} bytes`
  );

  // page numbers
  const numbered = await post('/page-numbers', await pdfForm({ position: 'bottom-right', format: 'page-n-of-total' }));
  check('page numbers returns 200', numbered.response.status === 200);

  // watermark
  const marked = await post('/watermark', await pdfForm({ text: 'DRAFT', opacity: 20 }));
  check('watermark returns 200', marked.response.status === 200);

  // non-latin watermark
  const badMark = await post('/watermark', await pdfForm({ text: '测试' }));
  check(
    'non-latin watermark rejected with a clear code',
    badMark.response.status === 400 && badMark.json?.code === 'unsupported_characters'
  );

  // unavailable tool
  const office = await post('/word-to-pdf', new FormData());
  check(
    'Word to PDF reports 503 + setup instead of faking success',
    office.response.status === 503 && Boolean(office.json?.setup)
  );

  const failed = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
};

run().catch((error) => {
  console.error('Test harness crashed:', error);
  process.exitCode = 1;
});
