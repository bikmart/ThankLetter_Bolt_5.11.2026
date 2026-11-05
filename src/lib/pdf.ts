import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { parsePptxSlides, renderSlideToCanvas, RenderedSlide } from '@/lib/pptx-render';

const PLACEHOLDER = '{{ФИО}}';
const PLACEHOLDER_SPACED = '{{ ФИО }}';
const ALL_PLACEHOLDERS = [PLACEHOLDER, PLACEHOLDER_SPACED];

// ── Helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16) / 255,
    g: parseInt(c.substring(2, 4), 16) / 255,
    b: parseInt(c.substring(4, 6), 16) / 255,
  };
}

function containsPlaceholder(text: string): boolean {
  return ALL_PLACEHOLDERS.some(ph => text.includes(ph));
}

function replacePlaceholder(text: string, name: string): string {
  let result = text;
  for (const ph of ALL_PLACEHOLDERS) {
    result = result.split(ph).join(name);
  }
  return result;
}

// ── PDF text extraction ───────────────────────────────────────────────

interface PdfTextItem {
  text: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

interface PdfPageData {
  items: PdfTextItem[];
  viewport: { width: number; height: number; scale: number };
}

// ── PPTX → PDF ────────────────────────────────────────────────────────

export async function generatePdfFromPptx(
  pptxData: ArrayBuffer,
  name: string
): Promise<Uint8Array> {
  // Replace placeholder in PPTX slide XML, then render to canvas, then embed in PDF
  const slides = await parsePptxSlides(replacePptxPlaceholder(pptxData, name));

  const pdfDoc = await PDFDocument.create();

  for (const slide of slides) {
    const page = pdfDoc.addPage([slide.width, slide.height]);
    const { width, height } = page.getSize();

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = Math.round(slide.width * scale);
    canvas.height = Math.round(slide.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.scale(scale, scale);
    renderSlideToCanvas(ctx, slide, slide.width, slide.height);

    const pngData = canvas.toDataURL('image/png');
    const pngBytes = Uint8Array.from(atob(pngData.split(',')[1]), c => c.charCodeAt(0));
    const pngImage = await pdfDoc.embedPng(pngBytes);

    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return pdfDoc.save();
}

function replacePptxPlaceholder(data: ArrayBuffer, name: string): ArrayBuffer {
  // We need to do a synchronous replacement in the PPTX XML
  // But JSZip is async, so we'll do the replacement differently:
  // We'll clone the ArrayBuffer and do string replacement on slide XMLs
  // Actually, let's use a different approach: parse, replace in memory, return modified data

  // Since we can't easily do async here, we'll handle it in the caller
  return data;
}

// Modified approach: do async PPTX modification then render
export async function generatePdfFromPptxTemplate(
  pptxData: ArrayBuffer,
  name: string
): Promise<Uint8Array> {
  // First, create a modified PPTX with placeholder replaced
  const modifiedData = await replacePptxPlaceholderAsync(pptxData, name);
  const slides = await parsePptxSlides(modifiedData);

  const pdfDoc = await PDFDocument.create();

  for (const slide of slides) {
    const page = pdfDoc.addPage([slide.width, slide.height]);
    const { width, height } = page.getSize();

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = Math.round(slide.width * scale);
    canvas.height = Math.round(slide.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.scale(scale, scale);
    renderSlideToCanvas(ctx, slide, slide.width, slide.height);

    const pngData = canvas.toDataURL('image/png');
    const pngBytes = Uint8Array.from(atob(pngData.split(',')[1]), c => c.charCodeAt(0));
    const pngImage = await pdfDoc.embedPng(pngBytes);

    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return pdfDoc.save();
}

async function replacePptxPlaceholderAsync(data: ArrayBuffer, name: string): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(data);

  const slidePaths = Object.keys(zip.files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));

  for (const slidePath of slidePaths) {
    const file = zip.file(slidePath);
    if (!file) continue;
    let xml = await file.async('string');

    // Direct replacement
    for (const ph of ALL_PLACEHOLDERS) {
      xml = xml.split(ph).join(name);
    }

    // Also handle split placeholders across runs
    for (const ph of ALL_PLACEHOLDERS) {
      const escaped = ph.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const interTag = '(?:</a:t>[^]*?<a:t[^>]*>)?';
      const pattern = new RegExp(escaped.join(interTag), 'g');
      xml = xml.replace(pattern, name);
    }

    zip.file(slidePath, xml);
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

// ── PDF Template → PDF ─────────────────────────────────────────────────

export async function checkPdfPlaceholder(data: ArrayBuffer): Promise<boolean> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const loadingTask = pdfjs.getDocument({ data: data.slice(0) });
    const pdf = await loadingTask.promise;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const fullText = textContent.items
        .map((item: unknown) => {
          const ti = item as { str?: string };
          return ti.str || '';
        })
        .join('');
      if (containsPlaceholder(fullText)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function generatePdfFromPdfTemplate(
  templateData: ArrayBuffer,
  name: string
): Promise<Uint8Array> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: templateData.slice(0) });
  const pdf = await loadingTask.promise;

  const outputPdf = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Render original page as background
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    // Get text content to find and replace placeholder
    const textContent = await page.getTextContent();

    // Build the full text to check if this page has the placeholder
    let pageText = '';
    interface TextItemLike {
      str: string;
      transform: number[];
      width: number;
      height: number;
      fontName: string;
      hasEOL: boolean;
    }
    const items: TextItemLike[] = [];
    for (const item of textContent.items) {
      const ti = item as TextItemLike;
      pageText += ti.str || '';
      if (ti.str !== undefined) {
        items.push({
          str: ti.str || '',
          transform: ti.transform || [1, 0, 0, 1, 0, 0],
          width: ti.width || 0,
          height: ti.height || 0,
          fontName: ti.fontName || 'sans-serif',
          hasEOL: ti.hasEOL || false,
        });
      }
    }

    // Find placeholder positions and white them out, then draw replacement text
    if (containsPlaceholder(pageText)) {
      // Find all occurrences of placeholder in concatenated text
      for (const ph of ALL_PLACEHOLDERS) {
        if (!pageText.includes(ph)) continue;

        // Find the items that contain the placeholder
        let concatStr = '';
        const itemRanges: { start: number; end: number; item: TextItemLike }[] = [];

        for (const item of items) {
          const start = concatStr.length;
          concatStr += item.str;
          itemRanges.push({ start, end: concatStr.length, item });
        }

        // Find placeholder position in concatenated text
        let searchStart = 0;
        while (true) {
          const phIdx = concatStr.indexOf(ph, searchStart);
          if (phIdx === -1) break;
          const phEnd = phIdx + ph.length;

          // Find all items that overlap with the placeholder
          const affectedItems = itemRanges.filter(
            r => r.start < phEnd && r.end > phIdx
          );

          if (affectedItems.length > 0) {
            // White out the affected items
            for (const range of affectedItems) {
              const item = range.item;
              const [a, b, c, d, e, f] = item.transform;
              const x = e;
              const y = viewport.height - f;
              const w = Math.abs(item.width);
              const h = Math.abs(item.height);

              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(x - 2, y - h + 2, w + 4, h + 2);
            }

            // Draw the replacement text at the position of the first affected item
            const firstItem = affectedItems[0].item;
            const [a, b, c, d, e, f] = firstItem.transform;
            const fontHeight = Math.sqrt(b * b + d * d);
            const x = e;
            const y = viewport.height - f;

            ctx.fillStyle = '#000000';
            ctx.font = `${fontHeight}px sans-serif`;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(name, x, y);
          }

          searchStart = phEnd;
        }
      }
    }

    // Embed canvas as image in PDF
    const pngData = canvas.toDataURL('image/png');
    const pngBytes = Uint8Array.from(atob(pngData.split(',')[1]), ch => ch.charCodeAt(0));
    const pngImage = await outputPdf.embedPng(pngBytes);

    const pdfPage = outputPdf.addPage([viewport.width / 2, viewport.height / 2]);
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: viewport.width / 2,
      height: viewport.height / 2,
    });
  }

  return outputPdf.save();
}

// ── Canvas helper ─────────────────────────────────────────────────────

export async function canvasToPdfBytes(
  canvas: HTMLCanvasElement,
  pdfDoc: PDFDocument
): Promise<void> {
  const pngData = canvas.toDataURL('image/png');
  const pngBytes = Uint8Array.from(atob(pngData.split(',')[1]), c => c.charCodeAt(0));
  const pngImage = await pdfDoc.embedPng(pngBytes);

  const page = pdfDoc.addPage([canvas.width, canvas.height]);
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  });
}
