import JSZip from 'jszip';

// ── Types ─────────────────────────────────────────────────────────────

interface SlideElement {
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  // text
  runs?: TextRun[];
  align?: CanvasTextAlign;
  lineSpacing?: number;
  spcBef?: number;
  spcAft?: number;
  // shape
  geom?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  noFill?: boolean;
  noLine?: boolean;
  textFit?: boolean;
  // image
  imageSrc?: string;
}

interface TextRun {
  text: string;
  size: number; // pt
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  font: string;
  baseline?: number; // percentage offset
}

export interface RenderedSlide {
  width: number;
  height: number;
  elements: SlideElement[];
  background?: SlideElement;
}

// ── Helpers ───────────────────────────────────────────────────────────

function mu2px(v: number): number {
  return v / 914400 * 96;
}

function emu2px(v: number): number {
  return v / 914400 * 96;
}

const FONT_MAP: Record<string, string> = {
  'Times New Roman': 'serif',
  'Georgia': 'Georgia, serif',
  'Cambria': 'serif',
  'Calibri': 'sans-serif',
  'Arial': 'Arial, sans-serif',
  'Helvetica': 'sans-serif',
  'Tahoma': 'Tahoma, sans-serif',
  'Verdana': 'Verdana, sans-serif',
  'Trebuchet MS': '"Trebuchet MS", sans-serif',
  'Segoe UI': '"Segoe UI", sans-serif',
  'Roboto': 'Roboto, sans-serif',
  'Courier New': '"Courier New", monospace',
  'Consolas': 'monospace',
  'Garamond': 'Garamond, serif',
  'Book Antiqua': 'serif',
};

function resolveFont(name: string): string {
  if (!name) return 'sans-serif';
  return FONT_MAP[name] || `${name}, sans-serif`;
}

function parseHexColor(hex: string): string {
  if (!hex) return '#000000';
  const c = hex.replace('#', '');
  if (c.length === 6) return `#${c}`;
  if (c.length === 3) return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`;
  return '#000000';
}

function resolveColor(schemeColors: Map<string, string>, ref?: string): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('#')) return parseHexColor(ref);
  // srgbClr
  const m = ref.match(/^srgbClr:([0-9A-Fa-f]+)$/i);
  if (m) return parseHexColor(m[1]);
  // schemeClr
  const sm = ref.match(/^schemeClr:(.+)$/);
  if (sm) return schemeColors.get(sm[1]) || '#000000';
  return parseHexColor(ref);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

// ── XML helpers ───────────────────────────────────────────────────────

function attr(el: Element, name: string): string | undefined {
  const v = el.getAttribute(name);
  return v ?? undefined;
}

function numAttr(el: Element, name: string): number | undefined {
  const v = attr(el, name);
  if (v === undefined) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

// ── Parse slide XML ───────────────────────────────────────────────────

function parseRun(
  rEl: Element,
  schemeColors: Map<string, string>
): TextRun {
  let text = '';
  const props = rEl.getElementsByTagName('a:rPr')[0];
  let size = 18;
  let bold = false;
  let italic = false;
  let underline = false;
  let color = '#000000';
  let font = 'Arial';
  let baseline = 0;

  if (props) {
    const sz = numAttr(props, 'sz');
    if (sz !== undefined) size = sz / 100;
    bold = attr(props, 'b') === '1';
    italic = attr(props, 'i') === '1';
    underline = attr(props, 'u') !== 'none' && attr(props, 'u') !== undefined;
    const baselineAttr = numAttr(props, 'baseline');
    if (baselineAttr !== undefined) baseline = baselineAttr / 1000;

    const srgb = props.getElementsByTagName('a:solidFill')[0]
      ?.getElementsByTagName('a:srgbClr')[0];
    if (srgb) {
      color = parseHexColor(attr(srgb, 'val') || '000000');
    } else {
      const schemeEl = props.getElementsByTagName('a:solidFill')[0]
        ?.getElementsByTagName('a:schemeClr')[0];
      if (schemeEl) {
        const last = schemeEl.getAttribute('lastClr');
        const val = attr(schemeEl, 'val');
        if (last) color = parseHexColor(last);
        else if (val && schemeColors.has(val)) color = schemeColors.get(val)!;
      }
    }

    const latin = props.getElementsByTagName('a:latin')[0];
    if (latin) font = attr(latin, 'typeface') || 'Arial';
    const ea = props.getElementsByTagName('a:ea')[0];
    if (ea && !latin) font = attr(ea, 'typeface') || font;
  }

  const tEl = rEl.getElementsByTagName('a:t')[0];
  if (tEl) text = decodeEntities(tEl.textContent || '');

  return { text, size, bold, italic, underline, color, font: resolveFont(font), baseline };
}

function parseParagraph(
  pEl: Element,
  schemeColors: Map<string, string>
): { runs: TextRun[]; align: CanvasTextAlign; lineSpacing: number; spcBef: number; spcAft: number } {
  let align: CanvasTextAlign = 'left';
  let lineSpacing = 1.2;
  let spcBef = 0;
  let spcAft = 0;

  const pPr = pEl.getElementsByTagName('a:pPr')[0];
  if (pPr) {
    const algn = attr(pPr, 'algn');
    if (algn === 'ctr') align = 'center';
    else if (algn === 'r') align = 'right';
    else if (algn === 'just') align = 'left';

    const lnSpc = pPr.getElementsByTagName('a:lnSpc')[0]
      ?.getElementsByTagName('a:spcPct')[0];
    if (lnSpc) {
      const v = numAttr(lnSpc, 'val');
      if (v !== undefined) lineSpacing = v / 100000;
    }

    const spcBefEl = pPr.getElementsByTagName('a:spcBef')[0]
      ?.getElementsByTagName('a:spcPts')[0];
    if (spcBefEl) {
      const v = numAttr(spcBefEl, 'val');
      if (v !== undefined) spcBef = v / 100;
    }

    const spcAftEl = pPr.getElementsByTagName('a:spcAft')[0]
      ?.getElementsByTagName('a:spcPts')[0];
    if (spcAftEl) {
      const v = numAttr(spcAftEl, 'val');
      if (v !== undefined) spcAft = v / 100;
    }
  }

  const runs: TextRun[] = [];
  // Iterate direct children only
  for (const child of Array.from(pEl.children)) {
    if (child.tagName === 'a:r') {
      runs.push(parseRun(child, schemeColors));
    } else if (child.tagName === 'a:br') {
      runs.push({ text: '\n', size: 0, bold: false, italic: false, underline: false, color: '#000000', font: 'sans-serif' });
    } else if (child.tagName === 'a:fld') {
      const t = child.getElementsByTagName('a:t')[0];
      if (t) runs.push({ text: decodeEntities(t.textContent || ''), size: 18, bold: false, italic: false, underline: false, color: '#000000', font: 'sans-serif' });
    }
  }

  return { runs, align, lineSpacing, spcBef, spcAft };
}

function parseShapeBody(
  spEl: Element,
  schemeColors: Map<string, string>
): SlideElement | null {
  const nvSpPr = spEl.getElementsByTagName('p:nvSpPr')[0];
  if (!nvSpPr) return null;

  const spPr = spEl.getElementsByTagName('p:spPr')[0];
  if (!spPr) return null;

  const xfrm = spPr.getElementsByTagName('a:xfrm')[0];
  if (!xfrm) return null;
  const off = xfrm.getElementsByTagName('a:off')[0];
  const ext = xfrm.getElementsByTagName('a:ext')[0];
  if (!off || !ext) return null;

  const x = emu2px(numAttr(off, 'x') || 0);
  const y = emu2px(numAttr(off, 'y') || 0);
  const w = emu2px(numAttr(ext, 'cx') || 0);
  const h = emu2px(numAttr(ext, 'cy') || 0);
  const rot = (numAttr(xfrm, 'rot') || 0) / 60000;

  // Shape geometry
  const prstGeom = spPr.getElementsByTagName('a:prstGeom')[0];
  const geom = prstGeom ? attr(prstGeom, 'prst') || 'rect' : 'rect';

  // Fill
  let fill: string | undefined;
  let noFill = false;
  const solidFill = spPr.getElementsByTagName('a:solidFill')[0];
  if (solidFill) {
    const srgb = solidFill.getElementsByTagName('a:srgbClr')[0];
    if (srgb) fill = parseHexColor(attr(srgb, 'val') || 'FFFFFF');
    else {
      const scheme = solidFill.getElementsByTagName('a:schemeClr')[0];
      if (scheme) {
        const last = scheme.getAttribute('lastClr');
        const val = attr(scheme, 'val');
        if (last) fill = parseHexColor(last);
        else if (val) fill = schemeColors.get(val) || '#FFFFFF';
      }
    }
  } else if (spPr.getElementsByTagName('a:noFill').length > 0) {
    noFill = true;
  }

  // Stroke
  let stroke: string | undefined;
  let strokeWidth = 1;
  let noLine = false;
  const ln = spPr.getElementsByTagName('a:ln')[0];
  if (ln) {
    const w = numAttr(ln, 'w');
    if (w !== undefined) strokeWidth = emu2px(w);
    const lnSolid = ln.getElementsByTagName('a:solidFill')[0];
    if (lnSolid) {
      const srgb = lnSolid.getElementsByTagName('a:srgbClr')[0];
      if (srgb) stroke = parseHexColor(attr(srgb, 'val') || '000000');
      else {
        const scheme = lnSolid.getElementsByTagName('a:schemeClr')[0];
        if (scheme) {
          const last = scheme.getAttribute('lastClr');
          const val = attr(scheme, 'val');
          if (last) stroke = parseHexColor(last);
          else if (val) stroke = schemeColors.get(val) || '#000000';
        }
      }
    }
    if (ln.getElementsByTagName('a:noFill').length > 0) noLine = true;
  } else {
    noLine = true;
  }

  // Text
  const txBody = spEl.getElementsByTagName('p:txBody')[0];
  const runs: TextRun[] = [];
  let align: CanvasTextAlign = 'left';
  let lineSpacing = 1.2;
  let spcBef = 0;
  let spcAft = 0;
  let textFit = false;

  if (txBody) {
    const bodyPr = txBody.getElementsByTagName('a:bodyPr')[0];
    const spAutoFit = bodyPr?.getElementsByTagName('a:spAutoFit')[0];
    const normAutofit = bodyPr?.getElementsByTagName('a:normAutofit')[0];
    if (spAutoFit || normAutofit) textFit = true;

    const paragraphs = Array.from(txBody.getElementsByTagName('a:p'));
    // Filter to direct children of txBody
    const directParas = paragraphs.filter(p => p.parentElement === txBody);
    const paraList = directParas.length > 0 ? directParas : paragraphs;

    for (let i = 0; i < paraList.length; i++) {
      if (i > 0) {
        runs.push({ text: '\n', size: 0, bold: false, italic: false, underline: false, color: '#000000', font: 'sans-serif' });
      }
      const p = parseParagraph(paraList[i], schemeColors);
      runs.push(...p.runs);
      if (i === 0) {
        align = p.align;
        lineSpacing = p.lineSpacing;
        spcBef = p.spcBef;
        spcAft = p.spcAft;
      }
    }
  }

  // Determine type
  const hasText = runs.length > 0 && runs.some(r => r.text.trim().length > 0);

  return {
    type: hasText ? 'text' : 'shape',
    x, y, w, h, rot,
    runs: hasText ? runs : undefined,
    align,
    lineSpacing,
    spcBef,
    spcAft,
    geom,
    fill,
    stroke,
    strokeWidth,
    noFill,
    noLine,
    textFit,
  };
}

function parsePicElement(
  picEl: Element,
  schemeColors: Map<string, string>,
  imageMap: Map<string, string>
): SlideElement | null {
  const spPr = picEl.getElementsByTagName('p:spPr')[0];
  if (!spPr) return null;
  const xfrm = spPr.getElementsByTagName('a:xfrm')[0];
  if (!xfrm) return null;
  const off = xfrm.getElementsByTagName('a:off')[0];
  const ext = xfrm.getElementsByTagName('a:ext')[0];
  if (!off || !ext) return null;

  const x = emu2px(numAttr(off, 'x') || 0);
  const y = emu2px(numAttr(off, 'y') || 0);
  const w = emu2px(numAttr(ext, 'cx') || 0);
  const h = emu2px(numAttr(ext, 'cy') || 0);
  const rot = (numAttr(xfrm, 'rot') || 0) / 60000;

  // Resolve the embedded image via the relationship rId
  let imageSrc: string | undefined;
  const blipFill = picEl.getElementsByTagName('a:blip')[0];
  if (blipFill) {
    const embed = blipFill.getAttribute('r:embed');
    if (embed) imageSrc = imageMap.get(embed);
  }

  return {
    type: 'image',
    x, y, w, h, rot,
    imageSrc,
    geom: 'rect',
    noFill: true,
    noLine: true,
  };
}

function parseRels(relsXml: string): Map<string, { type: string; target: string }> {
  const rels = new Map<string, { type: string; target: string }>();
  try {
    const doc = new DOMParser().parseFromString(relsXml, 'application/xml');
    const relationships = doc.getElementsByTagName('Relationship');
    for (const rel of Array.from(relationships)) {
      const id = rel.getAttribute('Id');
      const type = rel.getAttribute('Type') || '';
      const target = rel.getAttribute('Target') || '';
      if (id) rels.set(id, { type, target });
    }
  } catch {
    // ignore
  }
  return rels;
}

function resolveZipPath(basePath: string, target: string): string {
  const baseParts = basePath.split('/').filter(Boolean);
  const targetParts = target.split('/');
  const parts = target.startsWith('/') ? [] : baseParts;

  for (const part of targetParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join('/');
}

async function buildImageMap(
  zip: JSZip,
  slideRelsPath: string
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  const relsFile = zip.file(slideRelsPath);
  if (!relsFile) return imageMap;
  const relsXml = await relsFile.async('string');
  const rels = parseRels(relsXml);
  const slideDirectory = slideRelsPath.split('/_rels/')[0];

  for (const [id, { type, target }] of rels) {
    if (!type.toLowerCase().includes('/image')) continue;

    const imagePath = resolveZipPath(slideDirectory, target);
    const imgFile = zip.file(imagePath);
    if (!imgFile) continue;

    const blob = await imgFile.async('blob');
    const url = URL.createObjectURL(blob);
    imageMap.set(id, url);
  }

  return imageMap;
}

function parseSlideBackground(
  slideDoc: Document,
  imageMap: Map<string, string>,
  schemeColors: Map<string, string>,
  slideWidth: number,
  slideHeight: number
): SlideElement | null {
  const bgEl = slideDoc.getElementsByTagName('p:bg')[0];
  if (!bgEl) return null;

  const bgPr = bgEl.getElementsByTagName('p:bgPr')[0];
  if (!bgPr) return null;

  // Check for blip fill (background image)
  const blip = bgPr.getElementsByTagName('a:blip')[0];
  if (blip) {
    const embed = blip.getAttribute('r:embed');
    if (embed) {
      const imageSrc = imageMap.get(embed);
      if (imageSrc) {
        return { type: 'image', x: 0, y: 0, w: slideWidth, h: slideHeight, rot: 0, imageSrc, geom: 'rect', noFill: true, noLine: true };
      }
    }
  }

  // Check for solid fill
  const solidFill = bgPr.getElementsByTagName('a:solidFill')[0];
  if (solidFill) {
    const srgb = solidFill.getElementsByTagName('a:srgbClr')[0];
    if (srgb) {
      const fill = parseHexColor(attr(srgb, 'val') || 'FFFFFF');
      return { type: 'shape', x: 0, y: 0, w: slideWidth, h: slideHeight, rot: 0, fill, geom: 'rect', noFill: false, noLine: true };
    }
    const scheme = solidFill.getElementsByTagName('a:schemeClr')[0];
    if (scheme) {
      const last = scheme.getAttribute('lastClr');
      const val = attr(scheme, 'val');
      const fill = last ? parseHexColor(last) : (val && schemeColors.get(val)) || '#FFFFFF';
      return { type: 'shape', x: 0, y: 0, w: slideWidth, h: slideHeight, rot: 0, fill, geom: 'rect', noFill: false, noLine: true };
    }
  }

  return null;
}

function parseSchemeColors(themeXml: string): Map<string, string> {
  const colors = new Map<string, string>();
  try {
    const doc = new DOMParser().parseFromString(themeXml, 'application/xml');
    const clrScheme = doc.getElementsByTagName('a:clrScheme')[0];
    if (!clrScheme) return colors;
    for (const child of Array.from(clrScheme.children)) {
      const tag = child.tagName.replace('a:', '');
      const srgb = child.getElementsByTagName('a:srgbClr')[0];
      const sys = child.getElementsByTagName('a:sysClr')[0];
      if (srgb) {
        colors.set(tag, parseHexColor(attr(srgb, 'val') || '000000'));
      } else if (sys) {
        const last = sys.getAttribute('lastClr');
        if (last) colors.set(tag, parseHexColor(last));
      }
    }
  } catch {
    // ignore
  }
  return colors;
}

function parseSlideSize(presentationXml: string): { width: number; height: number } {
  try {
    const doc = new DOMParser().parseFromString(presentationXml, 'application/xml');
    const sldSz = doc.getElementsByTagName('p:sldSz')[0];
    if (sldSz) {
      const cx = numAttr(sldSz, 'cx') || 9144000;
      const cy = numAttr(sldSz, 'cy') || 6858000;
      return { width: emu2px(cx), height: emu2px(cy) };
    }
  } catch {
    // ignore
  }
  return { width: 960, height: 540 };
}

export async function parsePptxSlides(data: ArrayBuffer): Promise<RenderedSlide[]> {
  const zip = await JSZip.loadAsync(data);

  // Parse theme for scheme colors
  let schemeColors = new Map<string, string>();
  const themePath = Object.keys(zip.files).find(p => /^ppt\/theme\/theme\d+\.xml$/.test(p));
  if (themePath) {
    const themeXml = await zip.file(themePath)!.async('string');
    schemeColors = parseSchemeColors(themeXml);
  }

  // Parse presentation.xml for slide size
  let slideSize = { width: 960, height: 540 };
  const presFile = zip.file('ppt/presentation.xml');
  if (presFile) {
    const presXml = await presFile.async('string');
    slideSize = parseSlideSize(presXml);
  }

  // Parse slides
  const slidePaths = Object.keys(zip.files)
    .filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
      return na - nb;
    });

  const slides: RenderedSlide[] = [];

  for (const slidePath of slidePaths) {
    const file = zip.file(slidePath);
    if (!file) continue;
    const xml = await file.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');

    // Build image map from this slide's rels
    const relsPath = slidePath.replace(/^ppt\/slides\//, 'ppt/slides/_rels/') + '.rels';
    const imageMap = await buildImageMap(zip, relsPath);

    const elements: SlideElement[] = [];

    // Parse slide background
    const background = parseSlideBackground(doc, imageMap, schemeColors, slideSize.width, slideSize.height);

    // Parse shapes (sp) and pictures (pic) in order
    const spTree = doc.getElementsByTagName('p:spTree')[0];
    if (!spTree) continue;

    for (const child of Array.from(spTree.children)) {
      if (child.tagName === 'p:sp') {
        const el = parseShapeBody(child, schemeColors);
        if (el) elements.push(el);
      } else if (child.tagName === 'p:pic') {
        const el = parsePicElement(child, schemeColors, imageMap);
        if (el) elements.push(el);
      }
    }

    slides.push({ width: slideSize.width, height: slideSize.height, elements, background: background ?? undefined });
  }

  return slides;
}

// ── Render to canvas ──────────────────────────────────────────────────

function drawShape(
  ctx: CanvasRenderingContext2D,
  el: SlideElement
): void {
  ctx.save();
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  if (el.rot) {
    ctx.translate(cx, cy);
    ctx.rotate((el.rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  ctx.beginPath();
  if (el.geom === 'ellipse' || el.geom === 'ellipse') {
    ctx.ellipse(cx, cy, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
  } else if (el.geom === 'roundRect') {
    const r = Math.min(el.w, el.h) * 0.1;
    ctx.moveTo(el.x + r, el.y);
    ctx.lineTo(el.x + el.w - r, el.y);
    ctx.arcTo(el.x + el.w, el.y, el.x + el.w, el.y + r, r);
    ctx.lineTo(el.x + el.w, el.y + el.h - r);
    ctx.arcTo(el.x + el.w, el.y + el.h, el.x + el.w - r, el.y + el.h, r);
    ctx.lineTo(el.x + r, el.y + el.h);
    ctx.arcTo(el.x, el.y + el.h, el.x, el.y + el.h - r, r);
    ctx.lineTo(el.x, el.y + r);
    ctx.arcTo(el.x, el.y, el.x + r, el.y, r);
    ctx.closePath();
  } else {
    ctx.rect(el.x, el.y, el.w, el.h);
  }

  if (!el.noFill && el.fill) {
    ctx.fillStyle = el.fill;
    ctx.fill();
  }
  if (!el.noLine && el.stroke) {
    ctx.strokeStyle = el.stroke;
    ctx.lineWidth = el.strokeWidth || 1;
    ctx.stroke();
  }

  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (para === '') {
      lines.push('');
      continue;
    }
    const words = para.split(/(\s+)/);
    let current = '';

    for (const word of words) {
      const test = current + word;
      ctx.font = font;
      const metrics = ctx.measureText(test);
      if (metrics.width > maxWidth && current.trim().length > 0) {
        lines.push(current.trimEnd());
        current = word.trimStart();
      } else {
        current = test;
      }
    }

    if (current) lines.push(current.trimEnd());
  }

  return lines;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  el: SlideElement
): void {
  if (!el.runs) return;

  ctx.save();
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  if (el.rot) {
    ctx.translate(cx, cy);
    ctx.rotate((el.rot * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  // Draw background shape if any
  if (!el.noFill && el.fill) {
    ctx.beginPath();
    ctx.rect(el.x, el.y, el.w, el.h);
    ctx.fillStyle = el.fill;
    ctx.fill();
  }
  if (!el.noLine && el.stroke) {
    ctx.beginPath();
    ctx.rect(el.x, el.y, el.w, el.h);
    ctx.strokeStyle = el.stroke;
    ctx.lineWidth = el.strokeWidth || 1;
    ctx.stroke();
  }

  // Text rendering
  const padding = 4;
  const textW = el.w - padding * 2;
  const textX = el.x + padding;
  const textH = el.h - padding * 2;
  const startY = el.y + padding;

  // Build paragraphs from runs (split by \n)
  const paragraphs: { runs: TextRun[] }[] = [{ runs: [] }];
  for (const run of el.runs) {
    if (run.text === '\n') {
      paragraphs.push({ runs: [] });
    } else if (run.text.includes('\n')) {
      const parts = run.text.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) paragraphs.push({ runs: [] });
        if (parts[i]) {
          paragraphs[paragraphs.length - 1].runs.push({ ...run, text: parts[i] });
        }
      }
    } else {
      paragraphs[paragraphs.length - 1].runs.push(run);
    }
  }

  // Calculate total height for vertical centering
  const lineSpacing = el.lineSpacing || 1.2;
  const paraSpacing = (el.spcBef || 0) + (el.spcAft || 0);

  // First pass: measure all lines
  const paraLines: { lines: { runs: TextRun[] }[]; height: number }[] = [];
  let totalH = 0;

  for (const para of paragraphs) {
    if (para.runs.length === 0) {
      paraLines.push({ lines: [{ runs: [] }], height: 18 * lineSpacing });
      totalH += 18 * lineSpacing;
      continue;
    }

    // Determine dominant run for font/size
    const domRun = para.runs.find(r => r.size > 0) || para.runs[0];
    const size = domRun.size || 18;
    const font = `${domRun.italic ? 'italic ' : ''}${domRun.bold ? 'bold ' : ''}${size}px ${domRun.font}`;
    const lineH = size * lineSpacing;

    // Wrap text using the full paragraph text
    const fullText = para.runs.map(r => r.text).join('');
    ctx.font = font;
    const wrapped = wrapText(ctx, fullText, textW, font);

    const lines: { runs: TextRun[] }[] = [];
    let charIdx = 0;
    for (const line of wrapped) {
      const lineLen = line.length;
      // Find runs that cover this line
      const lineRuns: TextRun[] = [];
      let remaining = line;
      let runOffset = 0;

      for (const run of para.runs) {
        if (runOffset + run.text.length <= charIdx) {
          runOffset += run.text.length;
          continue;
        }
        if (runOffset >= charIdx + lineLen) break;

        const start = Math.max(0, charIdx - runOffset);
        const end = Math.min(run.text.length, charIdx + lineLen - runOffset);
        const segment = run.text.substring(start, end);
        if (segment) {
          lineRuns.push({ ...run, text: segment });
        }
        runOffset += run.text.length;
      }

      lines.push({ runs: lineRuns });
      charIdx += lineLen + (line.includes(' ') ? 0 : 0);
      // Account for the space that was consumed
      if (fullText[charIdx] === ' ') charIdx++;
    }

    const height = lines.length * lineH + paraSpacing;
    paraLines.push({ lines, height });
    totalH += height;
  }

  // Vertical alignment - default top, but PowerPoint often uses middle
  let curY = startY;
  if (totalH < textH) {
    // Center vertically
    curY = startY + (textH - totalH) / 2;
  }

  // Second pass: draw
  for (const para of paraLines) {
    const lineH = (para.lines[0]?.runs[0]?.size || 18) * lineSpacing;
    for (const line of para.lines) {
      if (line.runs.length === 0 || (line.runs.length === 1 && line.runs[0].text === '')) {
        curY += lineH;
        continue;
      }

      // Measure line width
      let lineWidth = 0;
      for (const run of line.runs) {
        const size = run.size || 18;
        const font = `${run.italic ? 'italic ' : ''}${run.bold ? 'bold ' : ''}${size}px ${run.font}`;
        ctx.font = font;
        lineWidth += ctx.measureText(run.text).width;
      }

      // Horizontal alignment
      let x = textX;
      if (el.align === 'center') x = el.x + (el.w - lineWidth) / 2;
      else if (el.align === 'right') x = el.x + el.w - padding - lineWidth;

      for (const run of line.runs) {
        const size = run.size || 18;
        const font = `${run.italic ? 'italic ' : ''}${run.bold ? 'bold ' : ''}${size}px ${run.font}`;
        ctx.font = font;
        ctx.fillStyle = run.color;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';

        const yOffset = run.baseline ? run.baseline * size / 100 : 0;
        ctx.fillText(run.text, x, curY + lineH * 0.8 + yOffset);

        if (run.underline) {
          const metrics = ctx.measureText(run.text);
          ctx.strokeStyle = run.color;
          ctx.lineWidth = Math.max(1, size / 18);
          ctx.beginPath();
          ctx.moveTo(x, curY + lineH * 0.82 + yOffset);
          ctx.lineTo(x + metrics.width, curY + lineH * 0.82 + yOffset);
          ctx.stroke();
        }

        x += ctx.measureText(run.text).width;
      }

      curY += lineH;
    }
    curY += paraSpacing;
  }

  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function drawImageElement(
  ctx: CanvasRenderingContext2D,
  el: SlideElement
): Promise<void> {
  if (!el.imageSrc) return;
  try {
    const img = await loadImage(el.imageSrc);
    ctx.save();
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    if (el.rot) {
      ctx.translate(cx, cy);
      ctx.rotate((el.rot * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(img, el.x, el.y, el.w, el.h);
    ctx.restore();
  } catch {
    // image failed to load — skip
  }
}

export async function renderSlideToCanvas(
  ctx: CanvasRenderingContext2D,
  slide: RenderedSlide,
  width: number,
  height: number
): Promise<void> {
  const scaleX = width / slide.width;
  const scaleY = height / slide.height;

  ctx.save();
  ctx.scale(scaleX, scaleY);

  // Draw background (default white, or slide background if present)
  if (slide.background) {
    if (slide.background.type === 'image' && slide.background.imageSrc) {
      await drawImageElement(ctx, slide.background);
    } else {
      ctx.fillStyle = slide.background.fill || '#FFFFFF';
      ctx.fillRect(0, 0, slide.width, slide.height);
    }
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, slide.width, slide.height);
  }

  // Draw elements in order
  for (const el of slide.elements) {
    if (el.type === 'image' && el.imageSrc) {
      await drawImageElement(ctx, el);
    } else if (el.type === 'shape') {
      drawShape(ctx, el);
    } else {
      drawText(ctx, el);
    }
  }

  ctx.restore();
}

export async function renderPptxToCanvas(
  pptxData: ArrayBuffer,
  scale = 2
): Promise<HTMLCanvasElement[]> {
  const slides = await parsePptxSlides(pptxData);
  const canvases: HTMLCanvasElement[] = [];

  for (const slide of slides) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(slide.width * scale);
    canvas.height = Math.round(slide.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.scale(scale, scale);
    await renderSlideToCanvas(ctx, slide, slide.width, slide.height);
    canvases.push(canvas);
  }

  return canvases;
}
