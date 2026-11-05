import { Package, Download, RotateCcw } from 'lucide-react';

export interface ResultCardProps {
  count: number;
  onRestart: () => void;
  onDownloadAgain: () => void;
}

export default function ResultCard({ count, onRestart, onDownloadAgain }: ResultCardProps) {
  const filesWord =
    count === 1 ? 'файл' : count < 5 ? 'файла' : 'файлов';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="h-2.5 bg-pine" />
      <div className="px-6 py-12 flex flex-col items-center justify-center text-center animate-fadeIn">
        <div className="w-20 h-20 rounded-full bg-pine/10 flex items-center justify-center mb-6 animate-popIn">
          <Package className="w-10 h-10 text-pine" />
        </div>
        <h2 className="font-serif text-3xl text-pine mb-3">Всё готово</h2>
        <p className="text-sm text-gray-600 max-w-md">
          Сгенерировано {count} {filesWord}. Автоматическое скачивание началось.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button
            onClick={onDownloadAgain}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            <Download className="w-4 h-4" />
            Скачать ещё раз
          </button>
          <button
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-pine text-white text-sm font-semibold hover:bg-pine-600 transition-all shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Начать заново
          </button>
        </div>
      </div>
    </div>
  );
}
