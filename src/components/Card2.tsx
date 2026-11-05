import { useState } from 'react';
import {
  UploadCloud,
  Presentation,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  Copy,
  Check as CheckIcon,
} from 'lucide-react';
import TemplatePreview from '@/components/TemplatePreview';

export type TemplateFormat = 'pptx';

const PLACEHOLDER = '{{ФИО}}';

function CopyBadge() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(PLACEHOLDER).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pine/10 text-pine text-sm font-mono font-medium align-middle transition-all hover:bg-pine/20 active:scale-95 cursor-pointer select-none"
    >
      {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {PLACEHOLDER}
      {copied && (
        <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-pine text-white text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap shadow-lg animate-popIn">
          Скопировано
        </span>
      )}
    </button>
  );
}

export interface Card2SummaryProps {
  format: TemplateFormat;
  onEdit: () => void;
}

export function Card2Summary({ format, onEdit }: Card2SummaryProps) {
  const label = 'PowerPoint';
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-pine/10 flex items-center justify-center">
            <Check className="w-5 h-5 text-pine" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-pine">Дизайн шаблона</p>
            <p className="text-xs text-gray-500">
              Шаблон готов к использованию ({label}, 1 слайд)
            </p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="text-sm text-pine font-medium hover:underline underline-offset-4"
        >
          Изменить
        </button>
      </div>
    </div>
  );
}

const FORMATS: { id: TemplateFormat; label: string; icon: typeof Presentation; accept: string }[] = [
  { id: 'pptx', label: 'PowerPoint', icon: Presentation, accept: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation' },
];

export interface Card2Props {
  format: TemplateFormat;
  onFormatChange: (f: TemplateFormat) => void;
  templateState: 'upload' | 'success';
  templateFileName?: string;
  templateData: ArrayBuffer | null;
  previewNames: string[];
  loading: boolean;
  error: string | null;
  dragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDrop: (e: React.DragEvent) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onReplace: () => void;
  onGenerate: () => void;
  generating: boolean;
}

export default function Card2({
  format,
  onFormatChange,
  templateState,
  templateFileName,
  templateData,
  previewNames,
  loading,
  error,
  dragOver,
  fileInputRef,
  onFileInput,
  onFileDrop,
  onDragOver,
  onDragLeave,
  onReplace,
  onGenerate,
  generating,
}: Card2Props) {
  return (
    <>
      <div className="px-6 pt-4 pb-0">
        <h2 className="text-lg font-semibold text-pine">Шаблон письма</h2>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Напишите в шаблоне <CopyBadge /> там, где должно быть ФИО. Этот текст автозаменится на ФИО человека при генерации
        </p>
      </div>

      <div className="px-6 pb-6 pt-4">
        {templateState === 'upload' && (
          <div className="animate-fadeIn">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-pine shadow-sm"
                  >
                    <Icon className="w-4 h-4" />
                    {f.label}
                  </div>
                );
              })}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={FORMATS.find((f) => f.id === format)?.accept}
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
                Нажмите или перетащите файл шаблона
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Поддерживается .pptx — до 20 МБ
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {templateState === 'success' && (
          <div className="animate-fadeIn space-y-3">
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-pine/10 flex items-center justify-center">
                  <Presentation className="w-5 h-5 text-pine" />
                </div>
                <div>
                  <p className="text-sm font-medium text-pine">
                    Шаблон готов к использованию (PowerPoint, 1 слайд)
                  </p>
                  {templateFileName && (
                    <p className="text-xs text-gray-500 mt-0.5">{templateFileName}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onReplace}
                className="inline-flex items-center gap-1.5 text-sm text-pine font-medium hover:underline underline-offset-4"
              >
                <RefreshCw className="w-4 h-4" />
                Заменить
              </button>
            </div>

            <div className="flex items-center gap-3 bg-pine/5 border border-pine/20 rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-lg bg-pine/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-pine" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-medium text-pine">Плейсхолдер найден</p>
              <span className="ml-auto font-mono text-sm text-pine bg-white border border-pine/20 rounded-md px-2 py-1">
                {'{{ФИО}}'}
              </span>
            </div>

            {templateData && (
              <TemplatePreview templateData={templateData} sampleNames={previewNames} />
            )}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onGenerate}
            disabled={templateState !== 'success' || generating}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1E4638] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Presentation className="w-5 h-5" />}
            Сгенерировать PPTX
          </button>
        </div>
      </div>
    </>
  );
}
