import { useState } from 'react';
import {
  UploadCloud,
  Link2,
  Check,
  Plus,
  Pencil,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
  GripVertical,
  ChevronsUpDown,
  Search,
} from 'lucide-react';
import { NameRecord } from '@/lib/names';
import { Case, CASES, declineName } from '@/lib/declension';

export type SortMode = 'original' | 'alpha';
export type Card1ViewState = 'select' | 'validation';

export interface Card1Props {
  view: Card1ViewState;
  sheetUrl: string;
  onSheetUrlChange: (v: string) => void;
  onSheetUrlFocus: () => void;
  onSheetsLoad: () => void;
  loading: boolean;
  error: string | null;
  dragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop: (e: React.DragEvent) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  sourceLabel: string;
  totalRecords: number;
  valid: NameRecord[];
  invalid: NameRecord[];
  sortedValid: NameRecord[];
  sortMode: SortMode;
  sortOpen: boolean;
  onToggleSort: () => void;
  onSortChange: (m: SortMode) => void;
  sortRef: React.RefObject<HTMLDivElement>;
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  selectedCount: number;
  caseMode: Case;
  caseOpen: boolean;
  onToggleCase: () => void;
  onCaseChange: (c: Case) => void;
  caseRef: React.RefObject<HTMLDivElement>;
  adding: boolean;
  addValue: string;
  onAddValueChange: (v: string) => void;
  onAddConfirm: () => void;
  onAddCancel: () => void;
  onAddStart: () => void;
  editingId: string | null;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onEditStart: (rec: NameRecord) => void;
  onEditConfirm: (id?: string) => void;
  onEditCancel: () => void;
  onDeleteValid: (id: string) => void;
  onDeleteInvalid: (id: string) => void;
  onReset: () => void;
  dragId: string | null;
  dragFrom: 'valid' | 'invalid' | null;
  dropSide: 'valid' | 'invalid' | null;
  onRowDragStart: (id: string, from: 'valid' | 'invalid') => void;
  onRowDragEnd: () => void;
  onDropZoneDrop: (side: 'valid' | 'invalid') => void;
  onDropZoneDragOver: (side: 'valid' | 'invalid') => void;
  onDropZoneDragLeave: (side: 'valid' | 'invalid') => void;
}

const COLLAPSED_ROWS = 10;
const ROW_H = 40;

export default function Card1(props: Card1Props) {
  const {
    view,
    sheetUrl,
    onSheetUrlChange,
    onSheetUrlFocus,
    onSheetsLoad,
    loading,
    error,
    dragOver,
    fileInputRef,
    onFileInput,
    onFileDrop,
    onDragOver,
    onDragLeave,
    sourceLabel,
    totalRecords,
    valid,
    invalid,
    sortedValid,
    sortMode,
    sortOpen,
    onToggleSort,
    onSortChange,
    sortRef,
    selectedIds,
    allSelected,
    onToggleSelect,
    onToggleSelectAll,
    selectedCount,
    caseMode,
    caseOpen,
    onToggleCase,
    onCaseChange,
    caseRef,
    adding,
    addValue,
    onAddValueChange,
    onAddConfirm,
    onAddCancel,
    onAddStart,
    editingId,
    editValue,
    onEditValueChange,
    onEditStart,
    onEditConfirm,
    onEditCancel,
    onDeleteValid,
    onDeleteInvalid,
    onReset,
    dragId,
    dropSide,
    onRowDragStart,
    onRowDragEnd,
    onDropZoneDrop,
    onDropZoneDragOver,
    onDropZoneDragLeave,
  } = props;

  const [validExpanded, setValidExpanded] = useState(false);
  const [invalidExpanded, setInvalidExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredValid = searchQuery.trim()
    ? sortedValid.filter((r) =>
        r.value.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : sortedValid;

  return (
    <>
      <div className="px-6 pt-4 pb-0">
        <h2 className="text-lg font-semibold text-pine">Источник имён</h2>
      </div>

      <div className="px-6 pb-6 pt-4">
        {view === 'select' && (
          <div className="animate-fadeIn">
            <label className="block text-sm font-medium text-pine mb-2">
              Ссылка на Гугл таблицу
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => onSheetUrlChange(e.target.value)}
                onFocus={onSheetUrlFocus}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-pine focus:ring-2 focus:ring-pine/20 outline-none text-sm transition-all"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5 mb-3">
              Таблица должна быть открыта для чтения «всем, у кого есть ссылка». Имена берутся из первого столбца
            </p>

            {loading && (
              <div className="inline-flex items-center gap-2 text-sm text-pine">
                <Loader2 className="w-4 h-4 animate-spin" />
                Загрузка...
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-3 animate-slideDown">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-sm font-semibold text-gray-500 tracking-wide">ИЛИ</span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={onFileInput}
              className="hidden"
            />
            <div
              onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
              onDragLeave={onDragLeave}
              onDrop={onFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                'border-2 border-dashed rounded-2xl py-14 px-6 text-center cursor-pointer transition-all',
                dragOver
                  ? 'border-pine bg-pine/5'
                  : 'border-gray-300 hover:border-pine hover:bg-pine/5',
              ].join(' ')}
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                {loading ? (
                  <Loader2 className="w-7 h-7 text-pine animate-spin" />
                ) : (
                  <UploadCloud className="w-7 h-7 text-gray-400" />
                )}
              </div>
              <p className="text-sm font-medium text-pine">
                Нажмите или перетащите файл
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Поддерживаются CSV, XLSX — до 5 МБ. Имена берутся из первого столбца
              </p>
            </div>
          </div>
        )}

        {view === 'validation' && (
          <div className="animate-fadeIn">
            <div className="flex flex-wrap md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl w-full">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-pine/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-pine" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-medium text-pine">
                  Список загружен
                </span>
                {sourceLabel && (
                  <span className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-500">
                    {sourceLabel}
                  </span>
                )}
                <span className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-500">
                  {totalRecords} записей
                </span>
                <button
                  onClick={onReset}
                  className="text-xs text-pine font-medium hover:underline underline-offset-4"
                >
                  Загрузить другой
                </button>
              </div>
            </div>

            <div className="flex flex-row gap-6 items-start w-fit">
              {/* VALID column */}
              <div
                onDragOver={(e) => { e.preventDefault(); onDropZoneDragOver('valid'); }}
                onDragLeave={() => onDropZoneDragLeave('valid')}
                onDrop={(e) => { e.preventDefault(); onDropZoneDrop('valid'); }}
                className={[
                  'rounded-xl border bg-white transition-all w-auto min-w-[280px] shrink-0',
                  dropSide === 'valid' ? 'border-pine ring-2 ring-pine/20' : 'border-gray-200',
                ].join(' ')}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-pine" />
                    <h3 className="text-sm font-semibold text-pine">ФИО</h3>
                    <span className="text-xs font-semibold text-pine bg-pine/10 px-2 py-0.5 rounded-full">
                      {valid.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={caseRef}>
                      <button
                        onClick={onToggleCase}
                        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-pine px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Падеж
                        <ChevronDown className={['w-3.5 h-3.5 transition-transform', caseOpen ? 'rotate-180' : ''].join(' ')} />
                      </button>
                      {caseOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={onToggleCase} />
                          <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-popIn">
                            {CASES.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => onCaseChange(c.id)}
                                className={['w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between', caseMode === c.id ? 'text-pine font-medium' : 'text-gray-600'].join(' ')}
                              >
                                {c.label}
                                {caseMode === c.id && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={onToggleSort}
                        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-pine px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Сортировать
                        <ChevronDown className={['w-3.5 h-3.5 transition-transform', sortOpen ? 'rotate-180' : ''].join(' ')} />
                      </button>
                      {sortOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={onToggleSort} />
                          <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-popIn">
                            <button
                              onClick={() => onSortChange('original')}
                              className={['w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between', sortMode === 'original' ? 'text-pine font-medium' : 'text-gray-600'].join(' ')}
                            >
                              Как в оригинале
                              {sortMode === 'original' && <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => onSortChange('alpha')}
                              className={['w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between', sortMode === 'alpha' ? 'text-pine font-medium' : 'text-gray-600'].join(' ')}
                            >
                              По алфавиту
                              {sortMode === 'alpha' && <Check className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={onAddStart}
                      className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-pine px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Добавить
                    </button>
                  </div>
                </div>

                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск"
                      aria-label="Поиск по ФИО"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-pine focus:ring-2 focus:ring-pine/20 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* select-all bar */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-pine focus:ring-pine/20 cursor-pointer accent-[#1E4638]"
                    />
                    <span className="text-xs text-gray-600">
                      {selectedCount > 0
                        ? `Выбрано: ${selectedCount} из ${valid.length}`
                        : 'Выбрать все'}
                    </span>
                  </label>
                </div>

                {adding && (
                  <div className="px-3 py-2 border-b border-gray-100 animate-slideDown">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={addValue}
                        onChange={(e) => onAddValueChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onAddConfirm();
                          if (e.key === 'Escape') onAddCancel();
                        }}
                        placeholder="Введите ФИО..."
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 focus:border-pine focus:ring-2 focus:ring-pine/20 outline-none"
                      />
                      <button onClick={onAddConfirm} className="px-3 py-1.5 text-xs font-medium text-white bg-pine rounded-lg hover:bg-pine-600">
                        Добавить
                      </button>
                      <button onClick={onAddCancel} className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className="list-scroll overflow-y-auto"
                  style={validExpanded ? { maxHeight: 'none' } : { maxHeight: `${COLLAPSED_ROWS * ROW_H}px` }}
                >
                  {filteredValid.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-8">
                      {searchQuery.trim() ? 'Ничего не найдено' : 'Список пуст'}
                    </p>
                  )}
                  {filteredValid.map((rec) => (
                    <div
                      key={rec.id}
                      draggable
                      onDragStart={() => onRowDragStart(rec.id, 'valid')}
                      onDragEnd={onRowDragEnd}
                      className={['group flex justify-between items-center gap-4 w-full overflow-hidden px-3 py-2 border-b border-gray-50 hover:bg-pine/5 transition-colors', dragId === rec.id ? 'dragging-row' : ''].join(' ')}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0" />
                        {editingId === rec.id ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => onEditValueChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onEditConfirm(rec.id);
                              if (e.key === 'Escape') onEditCancel();
                            }}
                            onBlur={() => onEditConfirm(rec.id)}
                            className="w-full px-3 py-1.5 text-sm border border-[#1E4638] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4638] bg-white text-gray-900"
                          />
                        ) : (
                          <>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(rec.id)}
                              onChange={() => onToggleSelect(rec.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 text-pine focus:ring-pine/20 cursor-pointer accent-[#1E4638] flex-shrink-0"
                            />
                            <span className={['text-sm truncate', selectedIds.has(rec.id) ? 'text-pine font-medium' : 'text-pine'].join(' ')}>
                              {declineName(rec.value, caseMode)}
                            </span>
                            {rec.manual && (
                              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                доб.
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {editingId === rec.id ? (
                        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                          <button onClick={() => onEditConfirm(rec.id)} className="p-1 text-pine hover:bg-pine/10 rounded"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={onEditCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto">
                          <button onClick={() => onEditStart(rec)} className="p-1 text-gray-400 hover:text-pine hover:bg-pine/10 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDeleteValid(rec.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {valid.length > COLLAPSED_ROWS && (
                  <button
                    onClick={() => setValidExpanded((v: boolean) => !v)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-pine font-medium hover:bg-pine/5 transition-colors border-t border-gray-100"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                    {validExpanded ? 'Свернуть' : 'Развернуть'}
                  </button>
                )}
              </div>

              {/* INVALID column */}
              <div
                onDragOver={(e) => { e.preventDefault(); onDropZoneDragOver('invalid'); }}
                onDragLeave={() => onDropZoneDragLeave('invalid')}
                onDrop={(e) => { e.preventDefault(); onDropZoneDrop('invalid'); }}
                className={['rounded-xl border bg-white transition-all w-auto min-w-[280px] shrink-0', dropSide === 'invalid' ? 'border-amberx-500 ring-2 ring-amberx-500/20' : 'border-gray-200'].join(' ')}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amberx-500" />
                    <h3 className="text-sm font-semibold text-amberx-700">Не попадёт в генерацию</h3>
                    <span className="text-xs font-semibold text-amberx-700 bg-amberx-100 px-2 py-0.5 rounded-full">{invalid.length}</span>
                  </div>
                </div>
                <div
                  className="list-scroll overflow-y-auto"
                  style={invalidExpanded ? { maxHeight: 'none' } : { maxHeight: `${COLLAPSED_ROWS * ROW_H}px` }}
                >
                  {invalid.length === 0 && <p className="text-center text-xs text-gray-400 py-8">Подозрительных записей нет</p>}
                  {invalid.map((rec) => (
                    <div
                      key={rec.id}
                      draggable
                      onDragStart={() => onRowDragStart(rec.id, 'invalid')}
                      onDragEnd={onRowDragEnd}
                      className={['group flex justify-between items-center gap-4 w-full overflow-hidden px-3 py-2 border-b border-gray-50 hover:bg-amberx-50 transition-colors', dragId === rec.id ? 'dragging-row' : ''].join(' ')}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0" />
                        {editingId === rec.id ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => onEditValueChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onEditConfirm(rec.id);
                              if (e.key === 'Escape') onEditCancel();
                            }}
                            onBlur={() => onEditConfirm(rec.id)}
                            className="w-full px-3 py-1.5 text-sm border border-[#1E4638] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4638] bg-white text-gray-900"
                          />
                        ) : (
                          <span className="text-sm text-gray-500 truncate">
                            {rec.value}
                          </span>
                        )}
                      </div>
                      {editingId === rec.id ? (
                        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                          <button onClick={() => onEditConfirm(rec.id)} className="p-1 text-pine hover:bg-pine/10 rounded"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={onEditCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto">
                          <button onClick={() => onEditStart(rec)} className="p-1 text-gray-400 hover:text-amberx-700 hover:bg-amberx-100 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDeleteInvalid(rec.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {invalid.length > COLLAPSED_ROWS && (
                  <button
                    onClick={() => setInvalidExpanded((v: boolean) => !v)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-pine font-medium hover:bg-pine/5 transition-colors border-t border-gray-100"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                    {invalidExpanded ? 'Свернуть' : 'Развернуть'}
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              Записи в правом столбце отфильтрованы и НЕ попадут в генерацию.
              Отредактируйте их или перетащите влево, если они верны.
            </p>


          </div>
        )}
      </div>
    </>
  );
}
