import * as XLSX from 'xlsx';
import { NameRecord, isLikelyFullName, makeId } from '@/lib/names';

export type ParseResult = {
  valid: NameRecord[];
  invalid: NameRecord[];
  total: number;
  sourceName?: string;
};

function classify(rows: string[]): { valid: NameRecord[]; invalid: NameRecord[] } {
  const valid: NameRecord[] = [];
  const invalid: NameRecord[] = [];
  rows.forEach((r) => {
    const rec: NameRecord = { id: makeId(), value: r };
    if (isLikelyFullName(r)) valid.push(rec);
    else invalid.push(rec);
  });
  return { valid, invalid };
}

function firstColumnFromAOA(aoa: unknown[][]): string[] {
  const rows: string[] = [];
  for (const row of aoa) {
    const cell = row[0];
    if (cell === null || cell === undefined) continue;
    const s = String(cell).trim();
    if (s) rows.push(s);
  }
  return rows;
}

function extractRows(ws: XLSX.WorkSheet): string[] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  });
  let rows = firstColumnFromAOA(aoa);
  if (rows.length && !isLikelyFullName(rows[0])) {
    rows = rows.slice(1);
  }
  return rows;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { valid: [], invalid: [], total: 0 };
  const rows = extractRows(ws);
  const { valid, invalid } = classify(rows);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return { valid, invalid, total: rows.length, sourceName: baseName };
}

export async function parseSheetUrl(url: string): Promise<ParseResult> {
  // 1. Extract the sheet ID from the URL.
  //    Supports all Google Sheets / Google Drive URL formats:
  //      - docs.google.com/spreadsheets/d/{id}/edit#gid=0        (address bar)
  //      - docs.google.com/spreadsheets/d/{id}/edit?usp=sharing  (Share → Copy link)
  //      - drive.google.com/file/d/{id}/view?usp=drivesdk        (Drive → Copy link)
  const m =
    url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
    url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
    url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) throw new Error('Не удалось определить ID таблицы по ссылке');
  const sheetId = m[1];

  // 2. Extract the gid (specific tab) if present — can be in #fragment or ?query
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  // 3. Extract resourcekey if present (Share → Copy link may include it)
  const rkMatch = url.match(/[?&]resourcekey=([^&]+)/);
  const resourcekey = rkMatch ? rkMatch[1] : null;

  // 4. Fetch CSV data. Try the gviz endpoint first (better CORS support in browsers),
  //    fall back to the export endpoint if gviz fails.
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}${resourcekey ? `&resourcekey=${resourcekey}` : ''}`;
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}${resourcekey ? `&resourcekey=${resourcekey}` : ''}`;

  let csvText: string | null = null;

  // Try gviz first — it returns proper CORS headers for browser fetches
  try {
    const res = await fetch(gvizUrl, { redirect: 'follow' });
    if (res.ok) {
      const text = await res.text();
      if (!text.trimStart().startsWith('<!DOCTYPE') && !text.trimStart().startsWith('<html')) {
        csvText = text;
      }
    }
  } catch {
    // gviz fetch failed (CORS, network, etc.) — try export endpoint
  }

  // Fall back to the export endpoint
  if (csvText === null) {
    try {
      const res = await fetch(exportUrl, { redirect: 'follow' });
      if (!res.ok) throw new Error('bad response');
      csvText = await res.text();
    } catch {
      throw new Error('fetch failed');
    }
  }

  // 5. Detect Google login/consent page returned instead of CSV data
  if (csvText.trimStart().startsWith('<!DOCTYPE') || csvText.trimStart().startsWith('<html')) {
    throw new Error('GOOGLE_AUTH_REDIRECT');
  }

  // 4. Parse CSV with XLSX (reuses the same extractRows/classify pipeline as file imports)
  const wb = XLSX.read(csvText, { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { valid: [], invalid: [], total: 0 };
  const rows = extractRows(ws);
  const { valid, invalid } = classify(rows);

  // 5. Fetch the sheet title for archive naming (best-effort, non-blocking on failure)
  let sourceName: string | undefined;
  try {
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
    const htmlText = await fetch(htmlUrl).then((res) => res.text());
    const titleMatch = htmlText.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1]
        .replace(/\s*-\s*Google\s+Sheets\s*$/i, '')
        .trim();
      if (title) sourceName = title;
    }
  } catch {
    // Title is nice-to-have; proceed without it
  }

  return { valid, invalid, total: rows.length, sourceName };
}
