import { useEffect, useRef, useState } from 'react';
import Card1, { SortMode } from '@/components/Card1';
import Card2, { TemplateFormat } from '@/components/Card2';
import ResultCard from '@/components/ResultCard';
import { NameRecord, isLikelyFullName, makeId } from '@/lib/names';
import { parseFile, parseSheetUrl, ParseResult } from '@/lib/parse';
import { generateCertificates, GenFormat, checkPptxPlaceholder } from '@/lib/generate';
import { Case, declineName } from '@/lib/declension';

function classify(rows: string[]): { valid: NameRecord[]; invalid: NameRecord[] } {
  const valid: NameRecord[] = [];
  const invalid: NameRecord[] = [];
  rows.forEach((r) => {
    const rec: NameRecord = { id: makeId(), value: r };
    if (isLikelyFullName(r)) {
      rec.originalIndex = valid.length;
      valid.push(rec);
    } else {
      invalid.push(rec);
    }
  });
  return { valid, invalid };
}

export default function App() {
  /* ---------- Card 1 state ---------- */
  const [view, setView] = useState<'select' | 'validation'>('select');
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceName, setSourceName] = useState<string | undefined>();
  const [totalRecords, setTotalRecords] = useState(0);
  const [valid, setValid] = useState<NameRecord[]>([]);
  const [invalid, setInvalid] = useState<NameRecord[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('original');
  const [sortOpen, setSortOpen] = useState(false);
  const [caseMode, setCaseMode] = useState<Case>('nominative');
  const [caseOpen, setCaseOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<'valid' | 'invalid' | null>(null);
  const [dropSide, setDropSide] = useState<'valid' | 'invalid' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const caseRef = useRef<HTMLDivElement>(null);
  const sheetsLoadRef = useRef<() => void>(() => {});

  /* ---------- Card 2 state ---------- */
  const [format, setFormat] = useState<TemplateFormat>('pptx');
  const [templateState, setTemplateState] = useState<'upload' | 'success'>('upload');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateDragOver, setTemplateDragOver] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const templateDataRef = useRef<ArrayBuffer | null>(null);

  /* ---------- derived ---------- */
  const sortedValid =
    sortMode === 'alpha'
      ? [...valid].sort((a, b) => a.value.localeCompare(b.value, 'ru'))
      : valid;
  const declinedNames = valid
    .filter((r) => selectedIds.has(r.id))
    .map((r) => declineName(r.value, caseMode));
  const selectedValid = valid.filter((r) => selectedIds.has(r.id));
  const allSelected = valid.length > 0 && selectedIds.size === valid.length;

  function applyResult(res: ParseResult, label: string) {
    setValid(res.valid);
    setInvalid(res.invalid);
    setTotalRecords(res.total);
    setSourceLabel(label);
    setSourceName(res.sourceName);
    setView('validation');
    setSelectedIds(new Set(res.valid.map((r) => r.id)));
  }

  function resetData() {
    setValid([]);
    setInvalid([]);
    setTotalRecords(0);
    setSourceLabel('');
    setSourceName(undefined);
    setView('select');
    setSheetUrl('');
    setError(null);
    setSelectedIds(new Set());
  }

  /* ---------- close sort/case dropdowns on outside click ---------- */
  useEffect(() => {
    if (!sortOpen && !caseOpen) return;
    function handler(e: MouseEvent) {
      if (sortOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (caseOpen && caseRef.current && !caseRef.current.contains(e.target as Node)) {
        setCaseOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen, caseOpen]);

  /* ---------- Card 1 handlers ---------- */
  async function handleSheetsLoad() {
    if (!sheetUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await parseSheetUrl(sheetUrl.trim());
      applyResult(res, 'Google Sheets');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'GOOGLE_AUTH_REDIRECT') {
        setError("Таблица не открыта для чтения. В настройках доступа выберите «Все, у кого есть ссылка» и скопируйте ссылку заново.");
      } else {
        setError("Таблица не загрузилась. Убедитесь, что таблица открыта для чтения всем, у кого есть ссылка, а сама ссылка верная. Или загрузите файл ниже");
      }
    } finally {
      setLoading(false);
    }
  }
  sheetsLoadRef.current = handleSheetsLoad;

  /* ---------- auto-load when a valid Sheets URL is pasted ---------- */
  useEffect(() => {
    const url = sheetUrl.trim();
    if (!url || view !== 'select') return;
    const looksLikeSheets = /\/spreadsheets\/d\/[a-zA-Z0-9-_]{20,}/.test(url) || /\/file\/d\/[a-zA-Z0-9-_]{20,}/.test(url) || /\/d\/[a-zA-Z0-9-_]{20,}/.test(url);
    if (!looksLikeSheets) return;
    const timer = setTimeout(() => sheetsLoadRef.current(), 600);
    return () => clearTimeout(timer);
  }, [sheetUrl, view]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const res = await parseFile(file);
      applyResult(res, file.name);
    } catch {
      setError('Не удалось обработать файл. Проверьте формат и повторите попытку.');
    } finally {
      setLoading(false);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleAddConfirm() {
    const v = addValue.trim();
    if (!v) return;
    const newRec: NameRecord = { id: makeId(), value: v, manual: true };
    setValid((prev) => [newRec, ...prev]);
    setSelectedIds((prev) => new Set(prev).add(newRec.id));
    setAddValue('');
    setAdding(false);
  }

  function handleEditStart(rec: NameRecord) {
    setEditingId(rec.id);
    setEditValue(rec.value);
  }

  function handleEditConfirm(targetId?: string) {
    const id = targetId ?? editingId;
    if (!id) return;
    const v = editValue.trim();
    if (!v) {
      setEditingId(null);
      setEditValue('');
      return;
    }
    const updated: NameRecord = { id, value: v };
    const inValid = valid.some((r) => r.id === id);
    const inInvalid = invalid.some((r) => r.id === id);
    if (isLikelyFullName(v)) {
      if (inInvalid) {
        setInvalid((prev) => prev.filter((r) => r.id !== id));
        setValid((prev) => [{ ...updated, manual: true }, ...prev]);
      } else {
        setValid((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    } else {
      if (inValid) {
        setValid((prev) => prev.filter((r) => r.id !== id));
        setInvalid((prev) => [...prev, updated]);
      } else {
        setInvalid((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    }
    setEditingId(null);
    setEditValue('');
  }

  function handleDeleteValid(id: string) {
    const rec = valid.find((r) => r.id === id);
    if (rec) {
      setValid((prev) => prev.filter((r) => r.id !== id));
      setInvalid((prev) => [...prev, rec]);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }
  function handleDeleteInvalid(id: string) {
    setInvalid((prev) => prev.filter((r) => r.id !== id));
  }

  function handleDropZoneDrop(side: 'valid' | 'invalid') {
    if (!dragId || !dragFrom || dragFrom === side) {
      setDragId(null);
      setDragFrom(null);
      setDropSide(null);
      return;
    }
    const rec =
      dragFrom === 'valid'
        ? valid.find((r) => r.id === dragId)
        : invalid.find((r) => r.id === dragId);
    if (rec) {
      if (side === 'valid') {
        if (rec.originalIndex !== undefined) {
          const restored: NameRecord = { id: rec.id, value: rec.value, originalIndex: rec.originalIndex };
          setSelectedIds((prev) => new Set(prev).add(rec.id));
          setValid((prev) => {
            const arr = [...prev];
            const idx = Math.min(rec.originalIndex!, arr.length);
            arr.splice(idx, 0, restored);
            return arr;
          });
        } else {
          setValid((prev) => [{ ...rec, manual: true }, ...prev]);
          setSelectedIds((prev) => new Set(prev).add(rec.id));
        }
        setInvalid((prev) => prev.filter((r) => r.id !== dragId));
      } else if (side === 'invalid') {
        setInvalid((prev) => [...prev, rec]);
        setValid((prev) => prev.filter((r) => r.id !== dragId));
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(dragId); return n; });
      }
    }
    setDragId(null);
    setDragFrom(null);
    setDropSide(null);
  }

  /* ---------- Card 2 handlers ---------- */
  function handleTemplateInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleTemplateFile(file);
  }

  async function handleTemplateFile(file: File) {
    if (format !== 'pptx') {
      setTemplateError('В данный момент поддерживается только формат PPTX.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setTemplateError('Файл должен быть в формате .pptx');
      return;
    }
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const buf = await file.arrayBuffer();
      const hasPlaceholder = await checkPptxPlaceholder(buf);
      if (!hasPlaceholder) {
        setTemplateError('В шаблоне не найден плейсхолдер {{ФИО}}. Добавьте его в нужное место на слайде.');
        return;
      }
      templateDataRef.current = buf;
      setTemplateFile(file);
      setTemplateState('success');
    } catch {
      setTemplateError('Не удалось загрузить шаблон. Проверьте формат файла.');
    } finally {
      setTemplateLoading(false);
    }
  }

  function handleTemplateDrop(e: React.DragEvent) {
    e.preventDefault();
    setTemplateDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleTemplateFile(file);
  }

  /* ---------- Card 2 generation ---------- */
  async function handleGenerate() {
    if (selectedValid.length === 0) return;
    setGenerating(true);
    try {
      const fmt: GenFormat = 'pptx';
      await generateCertificates(
        declinedNames,
        fmt,
        sourceName,
        templateDataRef.current
      );
      setShowResult(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось сгенерировать файлы. Попробуйте ещё раз.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  /* ---------- navigation ---------- */
  function handleRestart() {
    setShowResult(false);
    resetData();
    setFormat('pptx');
    setTemplateState('upload');
    setTemplateFile(null);
    templateDataRef.current = null;
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-cream border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 py-5 text-center">
          <h1 className="font-days text-2xl sm:text-3xl text-pine leading-tight tracking-wide">
            Генератор благодарственных писем
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 max-w-xl mx-auto">
            Загрузите список имён, шаблон письма и
            сгенерируйте письма в&nbsp;один клик
          </p>
        </div>
      </header>

      <main className="px-5 pb-24 pt-7">
        <div className="flex flex-col items-stretch w-fit mx-auto gap-6">
          <div className="w-fit mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* ===== Step 1 — always fully visible ===== */}
            <Card1
            view={view}
            sheetUrl={sheetUrl}
            onSheetUrlChange={(v) => { setSheetUrl(v); if (error) setError(null); }}
            onSheetUrlFocus={() => { if (error) setError(null); }}
            onSheetsLoad={handleSheetsLoad}
            loading={loading}
            error={error}
            dragOver={dragOver}
            fileInputRef={fileInputRef}
            onFileInput={handleFileInput}
            onFileDrop={handleFileDrop}
            onDragOver={() => setDragOver(true)}
            onDragLeave={() => setDragOver(false)}
            sourceLabel={sourceLabel}
            totalRecords={totalRecords}
            valid={valid}
            invalid={invalid}
            sortedValid={sortedValid}
            sortMode={sortMode}
            sortOpen={sortOpen}
            onToggleSort={() => setSortOpen((v) => !v)}
            onSortChange={(m) => { setSortMode(m); setSortOpen(false); }}
            sortRef={sortRef}
            selectedIds={selectedIds}
            allSelected={allSelected}
            onToggleSelect={(id) => setSelectedIds((prev) => {
              const n = new Set(prev);
              if (n.has(id)) n.delete(id); else n.add(id);
              return n;
            })}
            onToggleSelectAll={() => setSelectedIds(allSelected ? new Set() : new Set(valid.map((r) => r.id)))}
            selectedCount={selectedIds.size}
            caseMode={caseMode}
            caseOpen={caseOpen}
            onToggleCase={() => setCaseOpen((v) => !v)}
            onCaseChange={(c) => { setCaseMode(c); setCaseOpen(false); }}
            caseRef={caseRef}
            adding={adding}
            addValue={addValue}
            onAddValueChange={setAddValue}
            onAddConfirm={handleAddConfirm}
            onAddCancel={() => { setAdding(false); setAddValue(''); }}
            onAddStart={() => { setAdding(true); setAddValue(''); }}
            editingId={editingId}
            editValue={editValue}
            onEditValueChange={setEditValue}
            onEditStart={handleEditStart}
            onEditConfirm={handleEditConfirm}
            onEditCancel={() => { setEditingId(null); setEditValue(''); }}
            onDeleteValid={handleDeleteValid}
            onDeleteInvalid={handleDeleteInvalid}
            onReset={resetData}
            dragId={dragId}
            dragFrom={dragFrom}
            dropSide={dropSide}
            onRowDragStart={(id, from) => { setDragId(id); setDragFrom(from); }}
            onRowDragEnd={() => { setDragId(null); setDragFrom(null); setDropSide(null); }}
            onDropZoneDrop={handleDropZoneDrop}
            onDropZoneDragOver={(side) => setDropSide(side)}
            onDropZoneDragLeave={() => setDropSide(null)}
          />

          <div className="h-px bg-gray-100 mx-6" />

          {/* ===== Step 2 — always visible ===== */}
          <Card2
            format={format}
            onFormatChange={setFormat}
            templateState={templateState}
            templateFileName={templateFile?.name}
            templateData={templateDataRef.current}
            previewNames={declinedNames}
            loading={templateLoading}
            error={templateError}
            dragOver={templateDragOver}
            fileInputRef={templateInputRef}
            onFileInput={handleTemplateInput}
            onFileDrop={handleTemplateDrop}
            onDragOver={() => setTemplateDragOver(true)}
            onDragLeave={() => setTemplateDragOver(false)}
            onReplace={() => { setTemplateState('upload'); setTemplateError(null); setTemplateFile(null); templateDataRef.current = null; }}
            onGenerate={handleGenerate}
            generating={generating}
          />
          </div>

          {showResult && (
            <ResultCard
              count={selectedValid.length}
              onRestart={handleRestart}
              onDownloadAgain={() => generateCertificates(
                declinedNames,
                'pptx',
                sourceName,
                templateDataRef.current
              )}
            />
          )}
        </div>
      </main>
    </div>
  );
}
