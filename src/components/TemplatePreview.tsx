import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Loader2, X } from 'lucide-react';
import { generatePptxFromTemplateData } from '@/lib/generate';
import { parsePptxSlides, renderSlideToCanvas, RenderedSlide } from '@/lib/pptx-render';

export interface TemplatePreviewProps {
  templateData: ArrayBuffer;
  sampleNames: string[];
}

export default function TemplatePreview({ templateData, sampleNames }: TemplatePreviewProps) {
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState<RenderedSlide[] | null>(null);
  const [rendering, setRendering] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const safeNames = useMemo(
    () => (sampleNames.length > 0 ? sampleNames : ['—']),
    [sampleNames]
  );
  const currentName = safeNames[Math.min(index, safeNames.length - 1)];

  // Parse slides once per template
  useEffect(() => {
    let cancelled = false;
    setSlides(null);
    setPreviewImage(null);
    setIsExpanded(false);
    setRendering(true);
    parsePptxSlides(templateData)
      .then((parsed) => {
        if (!cancelled) setSlides(parsed);
      })
      .catch(() => {
        if (!cancelled) setSlides([]);
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateData]);

  // Render slide 0 with the current name replaced
  useEffect(() => {
    if (!slides || slides.length === 0) return;
    let cancelled = false;
    setRendering(true);
    setPreviewImage(null);
    generatePptxFromTemplateData(templateData, currentName)
      .then((replaced) => parsePptxSlides(replaced))
      .then((replacedSlides) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const slide = replacedSlides[0];
        if (!slide) return;
        const scale = 2;
        canvas.width = Math.round(slide.width * scale);
        canvas.height = Math.round(slide.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(scale, scale);
        return renderSlideToCanvas(ctx, slide, slide.width, slide.height).then(() => {
          if (!cancelled) setPreviewImage(canvas.toDataURL('image/png'));
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateData, currentName, slides]);

  useEffect(() => {
    if (!isExpanded) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setIsExpanded(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const hasSlides = slides && slides.length > 0;

  function prev() {
    setIndex((i) => (i - 1 + safeNames.length) % safeNames.length);
  }
  function next() {
    setIndex((i) => (i + 1) % safeNames.length);
  }

  return (
    <div className="w-0 min-w-full bg-pine/5 border border-pine/20 rounded-xl p-4 animate-fadeIn">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-pine" />
        <h4 className="text-sm font-semibold text-pine">Предпросмотр</h4>
        <span className="text-xs text-gray-500 ml-1">
          Так будет выглядеть письмо с реальным ФИО
        </span>
      </div>

      <div className="relative w-full min-w-0 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => previewImage && setIsExpanded(true)}
          disabled={!previewImage}
          aria-label="Открыть предпросмотр в полном размере"
          className="block w-full min-w-0 cursor-zoom-in disabled:cursor-default"
        >
          <canvas
            ref={canvasRef}
            className="block w-full max-w-full h-auto"
            style={{ display: hasSlides ? 'block' : 'none' }}
          />
        </button>
        {(rendering || !hasSlides) && (
          <div className="absolute inset-0 flex items-center justify-center min-h-[180px] bg-white">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs">
                {hasSlides === false ? 'Не удалось отобразить слайд' : 'Рендеринг...'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 gap-3">
        <button
          onClick={prev}
          disabled={safeNames.length <= 1}
          className="inline-flex items-center gap-1 text-sm text-pine font-medium px-2 py-1 rounded-md hover:bg-pine/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="text-sm font-semibold text-pine">{currentName}</span>
          <span className="text-xs text-gray-400">
            {Math.min(index + 1, safeNames.length)} из {safeNames.length}
          </span>
        </div>

        <button
          onClick={next}
          disabled={safeNames.length <= 1}
          className="inline-flex items-center gap-1 text-sm text-pine font-medium px-2 py-1 rounded-md hover:bg-pine/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Вперёд
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Предпросмотр шаблона в полном размере"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative flex max-h-full max-w-full items-center justify-center">
            <img
              src={previewImage}
              alt="Предпросмотр шаблона письма"
              className="block max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain rounded-lg bg-white shadow-2xl md:max-h-[calc(100vh-4rem)] md:max-w-[calc(100vw-4rem)]"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Закрыть увеличенный предпросмотр"
              className="absolute right-2 top-2 rounded-full bg-white/95 p-2 text-gray-600 shadow-lg transition-colors hover:bg-white hover:text-pine"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}