import JSZip from 'jszip';

export type GenFormat = 'pptx' | 'pdf';

const PLACEHOLDER = '{{ФИО}}';
const PLACEHOLDER_SPACED = '{{ ФИО }}';

function sanitizeForFs(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePlaceholderInXml(xml: string, name: string): string {
  for (const ph of [PLACEHOLDER, PLACEHOLDER_SPACED]) {
    const result = xml.split(ph).join(name);
    if (result !== xml) return result;
  }

  const interTag = '(?:</a:t>[^]*?<a:t[^>]*>)?';
  for (const ph of [PLACEHOLDER, PLACEHOLDER_SPACED]) {
    const chars = ph.split('').map(escapeRegex);
    const pattern = new RegExp(chars.join(interTag), 'g');
    const result = xml.replace(pattern, name);
    if (result !== xml) return result;
  }

  return xml;
}

export async function generatePptxFromTemplateData(
  templateData: ArrayBuffer,
  name: string
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(templateData);

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path));

  for (const slidePath of slidePaths) {
    const file = zip.file(slidePath);
    if (!file) continue;
    const xml = await file.async('string');
    const replaced = replacePlaceholderInXml(xml, name);
    zip.file(slidePath, replaced);
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function generatePptxFromTemplate(
  templateData: ArrayBuffer,
  name: string
): Promise<Blob> {
  const buf = await generatePptxFromTemplateData(templateData, name);
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

const PML_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const SLIDE_REL_TYPE = `${REL_NS}/slide`;
const NOTES_REL_SUFFIX = '/notesSlide';
const COMBINED_FILE_NAME = ' Все письма.pptx';

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function serializeXml(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

async function readZipXml(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`В шаблоне нет файла ${path}`);
  return file.async('string');
}

async function buildCombinedPptx(templateData: ArrayBuffer, names: string[]): Promise<Blob> {
  const zip = await JSZip.loadAsync(templateData);

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sourcePath = slidePaths[0];
  if (!sourcePath) throw new Error('В шаблоне нет слайдов');

  const sourceXml = await readZipXml(zip, sourcePath);
  const sourceRelsPath = sourcePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
  const sourceRelsDoc = parseXml(await readZipXml(zip, sourceRelsPath));
  for (const rel of Array.from(sourceRelsDoc.getElementsByTagName('Relationship'))) {
    if (rel.getAttribute('Type')?.endsWith(NOTES_REL_SUFFIX)) rel.parentNode?.removeChild(rel);
  }
  const slideRelsXml = serializeXml(sourceRelsDoc);

  for (const path of Object.keys(zip.files)) {
    if (/^ppt\/(slides|notesSlides)\//.test(path) && !zip.files[path].dir) zip.remove(path);
  }

  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  const presRelsDoc = parseXml(await readZipXml(zip, presRelsPath));
  const presRels = Array.from(presRelsDoc.getElementsByTagName('Relationship'));
  for (const rel of presRels) {
    if (rel.getAttribute('Type') === SLIDE_REL_TYPE) rel.parentNode?.removeChild(rel);
  }
  const maxRelId = presRels
    .filter((rel) => rel.getAttribute('Type') !== SLIDE_REL_TYPE)
    .reduce((max, rel) => Math.max(max, parseInt(rel.getAttribute('Id')?.replace(/\D/g, '') || '0', 10)), 0);
  const slideRelIds = names.map((_, i) => {
    const id = `rId${maxRelId + i + 1}`;
    const rel = presRelsDoc.createElementNS(presRelsDoc.documentElement.namespaceURI, 'Relationship');
    rel.setAttribute('Id', id);
    rel.setAttribute('Type', SLIDE_REL_TYPE);
    rel.setAttribute('Target', `slides/slide${i + 1}.xml`);
    presRelsDoc.documentElement.appendChild(rel);
    return id;
  });
  zip.file(presRelsPath, serializeXml(presRelsDoc));

  const presPath = 'ppt/presentation.xml';
  const presDoc = parseXml(await readZipXml(zip, presPath));
  const sldIdLst = presDoc.getElementsByTagNameNS(PML_NS, 'sldIdLst')[0];
  if (!sldIdLst) throw new Error('В шаблоне нет списка слайдов');
  while (sldIdLst.firstChild) sldIdLst.removeChild(sldIdLst.firstChild);
  slideRelIds.forEach((rId, i) => {
    const sldId = presDoc.createElementNS(PML_NS, 'p:sldId');
    sldId.setAttribute('id', String(256 + i));
    sldId.setAttributeNS(REL_NS, 'r:id', rId);
    sldIdLst.appendChild(sldId);
  });
  zip.file(presPath, serializeXml(presDoc));

  const ctPath = '[Content_Types].xml';
  const ctDoc = parseXml(await readZipXml(zip, ctPath));
  for (const override of Array.from(ctDoc.getElementsByTagNameNS(CT_NS, 'Override'))) {
    if (/^\/ppt\/(slides|notesSlides)\//.test(override.getAttribute('PartName') ?? '')) {
      override.parentNode?.removeChild(override);
    }
  }
  names.forEach((_, i) => {
    const override = ctDoc.createElementNS(CT_NS, 'Override');
    override.setAttribute('PartName', `/ppt/slides/slide${i + 1}.xml`);
    override.setAttribute('ContentType', SLIDE_CT);
    ctDoc.documentElement.appendChild(override);
  });
  zip.file(ctPath, serializeXml(ctDoc));

  names.forEach((name, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, replacePlaceholderInXml(sourceXml, name));
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, slideRelsXml);
  });

  const buf = await zip.generateAsync({ type: 'arraybuffer' });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

export async function checkPptxPlaceholder(data: ArrayBuffer): Promise<boolean> {
  const zip = await JSZip.loadAsync(data);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path));

  for (const path of slidePaths) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async('string');
    if (xml.includes(PLACEHOLDER) || xml.includes(PLACEHOLDER_SPACED)) return true;
  }
  return false;
}

function buildArchiveName(sourceName: string | undefined): string {
  if (sourceName) {
    const clean = sourceName.replace(/\+/g, ' ').trim();
    return `Благодарственные письма. ${sanitizeForFs(clean)}.zip`;
  }
  return 'Благодарственные письма.zip';
}

async function saveArchive(blob: Blob, filename: string): Promise<void> {
  const w = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  };

  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'ZIP-архив',
            accept: { 'application/zip': ['.zip'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function generateCertificates(
  names: string[],
  format: GenFormat,
  sourceName?: string,
  templateData?: ArrayBuffer | null
): Promise<number> {
  if (format === 'pptx' && !templateData) {
    throw new Error('Шаблон PPTX не загружен');
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const name of names) {
    let filename = sanitizeFileName(name);
    if (!filename) filename = 'Благодарственное_письмо';
    let n = 1;
    while (usedNames.has(filename)) {
      filename = `${sanitizeFileName(name)}_${n}`;
      n++;
    }
    usedNames.add(filename);

    if (format === 'pptx' && templateData) {
      const blob = await generatePptxFromTemplate(templateData, name);
      zip.file(`${filename}.pptx`, blob);
    } else {
      throw new Error(`Формат ${format} без шаблона не поддерживается`);
    }
  }

  if (format === 'pptx' && templateData) {
    zip.file(COMBINED_FILE_NAME, await buildCombinedPptx(templateData, names));
  }

  const archiveBlob = await zip.generateAsync({ type: 'blob' });
  const archiveName = buildArchiveName(sourceName);
  await saveArchive(archiveBlob, archiveName);

  return names.length;
}
