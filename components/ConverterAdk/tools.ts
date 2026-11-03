import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpDown,
  Copy,
  Droplets,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Files,
  Globe,
  Hash,
  Images,
  Layers,
  Lock,
  Minimize2,
  Presentation,
  RotateCw,
  ScanText,
  Scissors,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';

export type ToolCategoryId =
  | 'organize'
  | 'optimize'
  | 'to-pdf'
  | 'from-pdf'
  | 'edit'
  | 'security'
  | 'intelligence';
export type Availability = 'ready' | 'planned';
export type ToolRuntime = 'server' | 'client';

export interface ToolField {
  name: string;
  label: string;
  type: 'select' | 'number' | 'text' | 'textarea' | 'range' | 'toggle';
  defaultValue: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  visibleWhen?: { field: string; equals?: string; notEquals?: string };
}

export interface ToolWorkflow {
  endpoint: string;
  accept: string;
  fileLabel: string;
  multiple: boolean;
  minFiles: number;
  maxFiles: number;
  fields: ToolField[];
  actionLabel: string;
  outputExtension: 'pdf' | 'zip';
  outputName: (fileNames: string[]) => string;
  note?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  category: ToolCategoryId;
  from: string;
  to: string;
  keywords: string[];
  availability: Availability;
  runtime: ToolRuntime;
  blockedReason?: string;
  setup?: string;
  workflow?: ToolWorkflow;
}

export interface Capabilities {
  engines: { libreoffice: boolean; ghostscript: boolean };
  tools: Record<
    string,
    { state: 'ready' | 'unavailable'; runtime?: ToolRuntime; reason?: string; setup?: string }
  >;
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '').trim() || 'document';

const pdfOut = (suffix: string) => (names: string[]) => `${baseName(names[0] || 'document')}${suffix}.pdf`;

/** Page-selection fields shared by the page-manipulation tools. */
const pageField = (label: string, defaultValue = '', help?: string): ToolField => ({
  name: 'pages',
  label,
  type: 'text',
  defaultValue,
  placeholder: '1-3, 5, 8',
  help: help ?? 'Comma separated. Use 1-3 for a range.',
});

export const TOOL_CATEGORIES: Array<{
  id: ToolCategoryId;
  label: string;
  blurb: string;
  secondary?: boolean;
}> = [
  { id: 'organize', label: 'Organize PDF', blurb: 'Merge, split, reorder, extract and delete pages.', secondary: false },
  { id: 'optimize', label: 'Optimize PDF', blurb: 'Compress files and make them searchable.', secondary: false },
  { id: 'to-pdf', label: 'Convert to PDF', blurb: 'Images and documents into one clean PDF.', secondary: false },
  { id: 'from-pdf', label: 'Convert from PDF', blurb: 'Pull a PDF apart into images and office files.', secondary: false },
  { id: 'edit', label: 'Edit PDF', blurb: 'Rotate, number and watermark pages.', secondary: false },
  { id: 'security', label: 'PDF Security', blurb: 'Lock or unlock a document.', secondary: true },
  { id: 'intelligence', label: 'PDF Intelligence', blurb: 'Get the content back out.', secondary: true },
];

const READY = 'ready' as const;
const PLANNED = 'planned' as const;

export const CONVERTER_TOOLS: ToolDefinition[] = [
  /* ── to PDF ──────────────────────────────────────────────────────── */
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    tagline: 'Images into one PDF',
    description: 'Combine JPG and PNG images into a single PDF, in the order you choose.',
    icon: Images,
    category: 'to-pdf',
    from: 'JPG',
    to: 'PDF',
    keywords: ['image', 'photo', 'png', 'picture', 'scan', 'combine'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/image-to-pdf',
      accept: 'image/jpeg,image/png,.jpg,.jpeg,.png',
      fileLabel: 'JPG or PNG images',
      multiple: true,
      minFiles: 1,
      maxFiles: 30,
      fields: [
        {
          name: 'pageSize',
          label: 'Page size',
          type: 'select',
          defaultValue: 'a4',
          options: [
            { value: 'a4', label: 'A4 — 210 × 297 mm' },
            { value: 'letter', label: 'US Letter — 8.5 × 11 in' },
            { value: 'legal', label: 'US Legal — 8.5 × 14 in' },
            { value: 'original', label: 'Match each image' },
          ],
        },
        {
          name: 'orientation',
          label: 'Orientation',
          type: 'select',
          defaultValue: 'portrait',
          options: [
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ],
          visibleWhen: { field: 'pageSize', notEquals: 'original' },
        },
        {
          name: 'fit',
          label: 'Image fit',
          type: 'select',
          defaultValue: 'contain',
          options: [
            { value: 'contain', label: 'Preserve proportions' },
            { value: 'stretch', label: 'Fill the page' },
          ],
          help: 'Preserve proportions keeps the whole image visible.',
        },
        {
          name: 'margin',
          label: 'Margin',
          type: 'select',
          defaultValue: '24',
          options: [
            { value: '0', label: 'None' },
            { value: '24', label: 'Small (8 mm)' },
            { value: '48', label: 'Large (17 mm)' },
          ],
        },
      ],
      actionLabel: 'Create PDF',
      outputExtension: 'pdf',
      outputName: (names) => (names.length === 1 ? `${baseName(names[0])}.pdf` : 'converteradk-images.pdf'),
    },
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    tagline: 'DOC / DOCX → PDF',
    description: 'Keep text, tables, images and page layout from Word documents.',
    icon: FileText,
    category: 'to-pdf',
    from: 'DOCX',
    to: 'PDF',
    keywords: ['doc', 'docx', 'word', 'office', 'document'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'powerpoint-to-pdf',
    name: 'PowerPoint to PDF',
    tagline: 'PPT / PPTX → PDF',
    description: 'Slides become a PDF, one page per slide, with the order intact.',
    icon: Presentation,
    category: 'to-pdf',
    from: 'PPTX',
    to: 'PDF',
    keywords: ['ppt', 'pptx', 'slides', 'presentation', 'deck'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'excel-to-pdf',
    name: 'Excel to PDF',
    tagline: 'XLS / XLSX → PDF',
    description: 'Spreadsheets to PDF with worksheets and cell formatting preserved.',
    icon: FileSpreadsheet,
    category: 'to-pdf',
    from: 'XLSX',
    to: 'PDF',
    keywords: ['xls', 'xlsx', 'spreadsheet', 'sheet', 'table', 'excel'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'html-to-pdf',
    name: 'HTML to PDF',
    tagline: 'Web page → PDF',
    description: 'Render an uploaded HTML file or a public URL into a PDF.',
    icon: Globe,
    category: 'to-pdf',
    from: 'HTML',
    to: 'PDF',
    keywords: ['html', 'web', 'url', 'page', 'website'],
    availability: PLANNED,
    runtime: 'server',
  },

  /* ── from PDF ────────────────────────────────────────────────────── */
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPG',
    tagline: 'Pages → images',
    description: 'Render each page as a JPG. Download one page or the whole set as a ZIP.',
    icon: FileImage,
    category: 'from-pdf',
    from: 'PDF',
    to: 'JPG',
    keywords: ['image', 'png', 'jpg', 'render', 'pages', 'thumbnail'],
    availability: READY,
    runtime: 'client',
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    tagline: 'PDF → DOCX',
    description: 'Rebuild paragraphs, reading order and basic formatting in an editable document.',
    icon: FileText,
    category: 'from-pdf',
    from: 'PDF',
    to: 'DOCX',
    keywords: ['doc', 'docx', 'word', 'editable', 'text'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'pdf-to-powerpoint',
    name: 'PDF to PowerPoint',
    tagline: 'PDF → PPTX',
    description: 'One slide per PDF page, either visually faithful or editable where possible.',
    icon: Presentation,
    category: 'from-pdf',
    from: 'PDF',
    to: 'PPTX',
    keywords: ['ppt', 'pptx', 'slides', 'presentation'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel',
    tagline: 'PDF tables → XLSX',
    description: 'Detect tables, preview the rows and export them to a spreadsheet.',
    icon: FileSpreadsheet,
    category: 'from-pdf',
    from: 'PDF',
    to: 'XLSX',
    keywords: ['xls', 'xlsx', 'table', 'data', 'spreadsheet'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'pdf-to-pdfa',
    name: 'PDF to PDF/A',
    tagline: 'Archival profiles',
    description: 'Convert for long-term archiving and report the real validation result.',
    icon: ShieldCheck,
    category: 'from-pdf',
    from: 'PDF',
    to: 'PDF/A',
    keywords: ['archive', 'archival', 'pdfa', 'compliance', 'long term'],
    availability: PLANNED,
    runtime: 'server',
  },

  /* ── organize ────────────────────────────────────────────────────── */
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    tagline: 'Many files → one',
    description: 'Combine several PDFs into a single document in the order you add them.',
    icon: Layers,
    category: 'organize',
    from: 'PDF',
    to: 'PDF',
    keywords: ['combine', 'join', 'concat', 'append'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/merge',
      accept: 'application/pdf,.pdf',
      fileLabel: 'PDF files',
      multiple: true,
      minFiles: 2,
      maxFiles: 20,
      fields: [],
      actionLabel: 'Merge PDFs',
      outputExtension: 'pdf',
      outputName: () => 'converteradk-merged.pdf',
      note: 'Files are merged in the order shown — use the arrows to reorder.',
    },
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    tagline: 'One file → many',
    description: 'Split every page into its own PDF, or cut the document into custom ranges.',
    icon: Scissors,
    category: 'organize',
    from: 'PDF',
    to: 'ZIP',
    keywords: ['cut', 'separate', 'divide', 'range', 'pages'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/split',
      accept: 'application/pdf,.pdf',
      fileLabel: 'PDF file',
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      fields: [
        {
          name: 'mode',
          label: 'How to split',
          type: 'select',
          defaultValue: 'each',
          options: [
            { value: 'each', label: 'One PDF per page' },
            { value: 'ranges', label: 'Custom ranges' },
          ],
        },
        {
          name: 'ranges',
          label: 'Ranges (one per line)',
          type: 'textarea',
          defaultValue: '1-3\n4-6',
          placeholder: '1-3\n4-6',
          visibleWhen: { field: 'mode', equals: 'ranges' },
          help: 'Each line becomes its own PDF inside the ZIP.',
        },
      ],
      actionLabel: 'Split PDF',
      outputExtension: 'zip',
      outputName: (names) => `${baseName(names[0] || 'document')}-split.zip`,
    },
  },
  {
    id: 'extract-pages',
    name: 'Extract pages',
    tagline: 'Keep only what you need',
    description: 'Pull selected pages out of a PDF into a new document.',
    icon: Copy,
    category: 'organize',
    from: 'PDF',
    to: 'PDF',
    keywords: ['select', 'copy', 'subset', 'pages'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/extract-pages',
      accept: 'application/pdf,.pdf',
      fileLabel: 'PDF file',
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      fields: [pageField('Pages to keep', '1', 'Example: 1-3, 5, 8')],
      actionLabel: 'Extract pages',
      outputExtension: 'pdf',
      outputName: pdfOut('-pages'),
    },
  },
  {
    id: 'delete-pages',
    name: 'Delete pages',
    tagline: 'Drop unwanted pages',
    description: 'Remove specific pages and download the cleaned-up document.',
    icon: Trash2,
    category: 'organize',
    from: 'PDF',
    to: 'PDF',
    keywords: ['remove', 'erase', 'cut out'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/delete-pages',
      accept: 'application/pdf,.pdf',
      fileLabel: 'PDF file',
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      fields: [pageField('Pages to delete', '', 'Example: 2, 6-8')],
      actionLabel: 'Delete pages',
      outputExtension: 'pdf',
      outputName: pdfOut('-edited'),
    },
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    tagline: 'Fix page orientation',
    description: 'Turn all pages or just a few by 90, 180 or 270 degrees.',
    icon: RotateCw,
    category: 'edit',
    from: 'PDF',
    to: 'PDF',
    keywords: ['orientation', 'sideways', 'turn', 'landscape'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/rotate',
      accept: 'application/pdf,.pdf',
      fileLabel: 'PDF file',
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      fields: [
        {
          name: 'angle',
          label: 'Rotation',
          type: 'select',
          defaultValue: '90',
          options: [
            { value: '90', label: '90° clockwise' },
            { value: '180', label: '180°' },
            { value: '270', label: '90° anticlockwise' },
          ],
        },
        {
          name: 'pages',
          label: 'Pages (blank = all)',
          type: 'text',
          defaultValue: '',
          placeholder: 'All pages',
          help: 'Example: 1, 4-6',
        },
      ],
      actionLabel: 'Rotate PDF',
      outputExtension: 'pdf',
      outputName: pdfOut('-rotated'),
    },
  },
  {
    id: 'reorder-pages',
    name: 'Reorder pages',
    tagline: 'Put pages in order',
    description: 'Rearrange a document by listing the new page order.',
    icon: ArrowUpDown,
    category: 'organize',
    from: 'PDF',
    to: 'PDF',
    keywords: ['sort', 'move', 'order', 'arrange'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/reorder-pages',
      accept: 'application/pdf,.pdf',
      fileLabel: 'PDF file',
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      fields: [
        {
          name: 'order',
          label: 'New page order',
          type: 'text',
          defaultValue: '',
          placeholder: '3, 1, 2',
          help: 'List every page number once, in the order you want.',
        },
      ],
      actionLabel: 'Reorder pages',
      outputExtension: 'pdf',
      outputName: pdfOut('-reordered'),
    },
  },

  /* ── edit & secure ───────────────────────────────────────────────── */
  {
    id: 'add-page-numbers',
    name: 'Add page numbers',
    tagline: 'Number every page',
    description: 'Stamp page numbers or “Page n of total” in a corner of the page.',
    icon: Hash,
    category: 'edit',
    from: 'PDF',
    to: 'PDF',
    keywords: ['numbering', 'footer', 'pagination', 'stamp'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/page-numbers',
      accept: 'application/pdf,.pdf',
      fileLabel: 'PDF file',
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      fields: [
        {
          name: 'position',
          label: 'Position',
          type: 'select',
          defaultValue: 'bottom-center',
          options: [
            { value: 'bottom-center', label: 'Bottom centre' },
            { value: 'bottom-right', label: 'Bottom right' },
            { value: 'bottom-left', label: 'Bottom left' },
            { value: 'top-center', label: 'Top centre' },
            { value: 'top-right', label: 'Top right' },
          ],
        },
        {
          name: 'format',
          label: 'Format',
          type: 'select',
          defaultValue: 'n',
          options: [
            { value: 'n', label: '1, 2, 3…' },
            { value: 'page-n-of-total', label: 'Page 1 of 12' },
          ],
        },
        { name: 'startAt', label: 'Start numbering at', type: 'number', defaultValue: 1, min: 0, max: 9999 },
      ],
      actionLabel: 'Add page numbers',
      outputExtension: 'pdf',
      outputName: pdfOut('-numbered'),
    },
  },
  {
    id: 'text-watermark',
    name: 'Text watermark',
    tagline: 'Mark every page',
    description: 'Add a diagonal text watermark with adjustable size and opacity.',
    icon: Droplets,
    category: 'edit',
    from: 'PDF',
    to: 'PDF',
    keywords: ['draft', 'confidential', 'stamp', 'overlay'],
    availability: READY,
    runtime: 'server',
    workflow: {
      endpoint: '/api/converter/watermark',
      accept: 'application/pdf,.pdf',
      fileLabel: 'PDF file',
      multiple: false,
      minFiles: 1,
      maxFiles: 1,
      fields: [
        {
          name: 'text',
          label: 'Watermark text',
          type: 'text',
          defaultValue: 'CONFIDENTIAL',
          placeholder: 'CONFIDENTIAL',
          help: 'Latin characters only (A–Z, 0–9, punctuation).',
        },
        { name: 'fontSize', label: 'Size', type: 'number', defaultValue: 52, min: 12, max: 120 },
        { name: 'opacity', label: 'Opacity', type: 'range', defaultValue: 15, min: 5, max: 60, step: 5, help: 'Percent' },
      ],
      actionLabel: 'Add watermark',
      outputExtension: 'pdf',
      outputName: pdfOut('-watermarked'),
    },
  },
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    tagline: 'Smaller file size',
    description: 'Shrink embedded images and fonts without visible quality loss.',
    icon: Minimize2,
    category: 'optimize',
    from: 'PDF',
    to: 'PDF',
    keywords: ['reduce', 'smaller', 'optimise', 'optimize', 'size'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'password-protect',
    name: 'Password protect',
    tagline: 'Encrypt a PDF',
    description: 'Lock a document behind a password with standard PDF encryption.',
    icon: Lock,
    category: 'security',
    from: 'PDF',
    to: 'PDF',
    keywords: ['encrypt', 'secure', 'lock', 'protect'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    tagline: 'Remove a password',
    description: 'Remove protection from documents you own and can supply credentials for.',
    icon: Unlock,
    category: 'security',
    from: 'PDF',
    to: 'PDF',
    keywords: ['decrypt', 'password', 'remove protection'],
    availability: PLANNED,
    runtime: 'server',
  },

  /* ── extract ─────────────────────────────────────────────────────── */
  {
    id: 'extract-text',
    name: 'Extract text',
    tagline: 'PDF → plain text',
    description: 'Recover the text layer of a PDF, page by page.',
    icon: FileSearch,
    category: 'intelligence',
    from: 'PDF',
    to: 'TXT',
    keywords: ['text', 'copy', 'content', 'plain'],
    availability: PLANNED,
    runtime: 'server',
  },
  {
    id: 'ocr-pdf',
    name: 'OCR scanned PDF',
    tagline: 'Images → searchable text',
    description: 'Recognise text in scanned pages so the document becomes searchable.',
    icon: ScanText,
    category: 'optimize',
    from: 'PDF',
    to: 'TXT',
    keywords: ['scan', 'ocr', 'tesseract', 'searchable', 'recognise'],
    availability: PLANNED,
    runtime: 'server',
  },
];

export const findTool = (id: string | null | undefined) =>
  CONVERTER_TOOLS.find((tool) => tool.id === id) ?? null;

export const readyToolCount = (tools: ToolDefinition[]) =>
  tools.filter((tool) => tool.availability === 'ready').length;

export const matchesQuery = (tool: ToolDefinition, rawQuery: string) => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    tool.name,
    tool.tagline,
    tool.description,
    tool.from,
    tool.to,
    ...tool.keywords,
  ]
    .join(' ')
    .toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
};

/**
 * Merge the static registry with what the API actually reports. A tool that the
 * server cannot run is demoted to "planned" with the server's own reason, so the
 * UI never offers a button that cannot work.
 */
export const applyCapabilities = (caps: Capabilities | null): ToolDefinition[] => {
  if (!caps?.tools) return CONVERTER_TOOLS;
  return CONVERTER_TOOLS.map((tool) => {
    const remote = caps.tools[tool.id];
    if (!remote) return tool;
    if (remote.state === 'unavailable') {
      return {
        ...tool,
        availability: 'planned',
        blockedReason: remote.reason || tool.blockedReason,
        setup: remote.setup || tool.setup,
      };
    }
    return { ...tool, availability: 'ready' };
  });
};
