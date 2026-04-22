import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAttachments } from '../hooks/useAttachments';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface AttachmentsSectionProps {
  taskId: number;
  currentUserId: number;
  onCountChange?: (count: number) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return (
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mimeType.includes('pdf')) {
    return (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return (
      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
};

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({ taskId, currentUserId, onCountChange }) => {
  const { t, i18n } = useTranslation('taskManager');
  React.useEffect(() => {
    const lang = i18n.language;
    if (TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(lang, 'taskManager', TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);
  const { attachments, loading, uploading, error, uploadFile, downloadFile, previewImage, fetchThumbnail, deleteAttachment } = useAttachments(taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewNaturalSize, setPreviewNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [previewViewportSize, setPreviewViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const previewBodyRef = useRef<HTMLDivElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Обновляем счетчик только после первой загрузки данных
  React.useEffect(() => {
    if (onCountChange && !loading && attachments.length >= 0) {
      onCountChange(attachments.length);
    }
  }, [attachments.length, loading]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i]);
    }
    // Счетчик обновится автоматически через useEffect
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');
  const imageAttachments = React.useMemo(
    () => attachments.filter((a) => isImage(a.mime_type)),
    [attachments]
  );

  const openPreviewByIndex = async (index: number) => {
    if (index < 0 || index >= imageAttachments.length) return;
    const file = imageAttachments[index];
    const url = await previewImage(file.id);
    if (!url) return;
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(url);
    setPreviewName(file.file_name);
    setPreviewIndex(index);
    setPreviewZoom(1);
    setPreviewNaturalSize({ width: 0, height: 0 });
    setPreviewPan({ x: 0, y: 0 });
    setIsPanning(false);
    setPreviewOpen(true);
  };

  const openPreview = async (attachmentId: number) => {
    const idx = imageAttachments.findIndex((a) => a.id === attachmentId);
    if (idx === -1) return;
    await openPreviewByIndex(idx);
  };

  const canGoPrev = previewIndex > 0;
  const canGoNext = previewIndex >= 0 && previewIndex < imageAttachments.length - 1;

  const showPrev = async () => {
    if (!canGoPrev) return;
    await openPreviewByIndex(previewIndex - 1);
  };

  const showNext = async () => {
    if (!canGoNext) return;
    await openPreviewByIndex(previewIndex + 1);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewName('');
    setPreviewIndex(-1);
    setPreviewZoom(1);
    setPreviewNaturalSize({ width: 0, height: 0 });
    setPreviewPan({ x: 0, y: 0 });
    setIsPanning(false);
  };

  const clampZoom = (z: number) => Math.max(0.25, Math.min(8, z));
  const zoomIn = () => setPreviewZoom((z) => clampZoom(z + 0.25));
  const zoomOut = () => setPreviewZoom((z) => clampZoom(z - 0.25));
  const zoomReset = () => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
    setIsPanning(false);
  };

  const startPan = (e: React.MouseEvent<HTMLDivElement>) => {
    if (previewZoom <= 1) return;
    e.preventDefault();
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: previewPan.x,
      baseY: previewPan.y,
    };
    setIsPanning(true);
  };

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  React.useEffect(() => {
    if (previewZoom <= 1) {
      setPreviewPan({ x: 0, y: 0 });
      setIsPanning(false);
      panStartRef.current = null;
    }
  }, [previewZoom]);

  React.useEffect(() => {
    if (!isPanning) return;
    const onMouseMove = (e: MouseEvent) => {
      const st = panStartRef.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      setPreviewPan({ x: st.baseX + dx, y: st.baseY + dy });
    };
    const onMouseUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isPanning]);

  React.useEffect(() => {
    if (!previewOpen) return;
    const updateViewportSize = () => {
      const el = previewViewportRef.current;
      if (!el) return;
      setPreviewViewportSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    updateViewportSize();
    const resizeObserver = new ResizeObserver(() => updateViewportSize());
    if (previewViewportRef.current) resizeObserver.observe(previewViewportRef.current);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePreview();
        return;
      }
      if (e.key === 'ArrowLeft') {
        void showPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        void showNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const target = e.target as Node | null;
      if (previewBodyRef.current && target && previewBodyRef.current.contains(target)) {
        // Блокируем browser/page zoom, чтобы увеличивалось только изображение.
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handler, { passive: false });
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wheel', handler);
    };
  }, [previewOpen, previewIndex, imageAttachments.length]);

  const renderedLayout = React.useMemo(() => {
    const naturalW = previewNaturalSize.width;
    const naturalH = previewNaturalSize.height;
    const viewportW = previewViewportSize.width;
    const viewportH = previewViewportSize.height;

    if (!naturalW || !naturalH || !viewportW || !viewportH) {
      return { width: 0, height: 0, detailScale: 1, fillThreshold: 1 };
    }

    const fitScale = Math.min(viewportW / naturalW, viewportH / naturalH);
    const fittedW = naturalW * fitScale;
    const fittedH = naturalH * fitScale;

    // Фаза 1: растим "рамку" изображения до упора в viewport по обеим осям.
    // Фаза 2: после потолка продолжаем приближение как обычный zoom (scale).
    const fillThreshold = Math.max(viewportW / fittedW, viewportH / fittedH, 1);
    const frameZoom = Math.min(previewZoom, fillThreshold);
    const detailScale = previewZoom > fillThreshold ? previewZoom / fillThreshold : 1;

    const width = fittedW * frameZoom;
    const height = fittedH * frameZoom;
    return { width, height, detailScale, fillThreshold };
  }, [previewNaturalSize, previewViewportSize, previewZoom]);

  if (loading && attachments.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 text-sm">{t('filesLoading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drag & Drop область */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>

        <p className="text-sm text-gray-700 mb-1">
          {uploading ? t('filesUploading') : t('filesDragDrop')}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          {t('filesSelectFromComputer')}
        </button>
      </div>

      {/* Список файлов */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">{t('filesUploaded')} ({attachments.length})</h4>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              {/* Иконка файла */}
              {isImage(attachment.mime_type) ? (
                <LazyThumbnail
                  attachmentId={attachment.id}
                  fileName={attachment.file_name}
                  fetchThumbnail={fetchThumbnail}
                />
              ) : (
                getFileIcon(attachment.mime_type)
              )}

              {/* Информация о файле */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {attachment.file_name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(attachment.file_size)} • {attachment.uploaded_by_name} •{' '}
                  {format(new Date(attachment.uploaded_at), 'dd MMM yyyy', { locale: ru })}
                </p>
              </div>

              {/* Действия */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {isImage(attachment.mime_type) && (
                  <button
                    onClick={() => openPreview(attachment.id)}
                    className="p-1.5 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                    title="Open"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => downloadFile(attachment.id, attachment.file_name)}
                  className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title={t('filesDownload')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {attachment.uploaded_by === currentUserId && (
                  <button
                    onClick={async () => {
                      if (confirm(t('filesDeleteConfirm'))) {
                        await deleteAttachment(attachment.id);
                        // Счетчик обновится автоматически через useEffect
                      }
                    }}
                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title={t('filesDelete')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-6">
          <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm truncate">{previewName}</span>
              <div className="flex items-center gap-2">
                <span className="text-white/90 text-xs min-w-[56px] text-center">
                  {previewIndex + 1}/{imageAttachments.length}
                </span>
                <button
                  onClick={zoomOut}
                  className="text-white hover:text-gray-200 text-sm px-2 py-1 rounded border border-white/30"
                  title="Zoom out"
                >
                  -
                </button>
                <button
                  onClick={zoomReset}
                  className="text-white hover:text-gray-200 text-xs px-2 py-1 rounded border border-white/30 min-w-[56px]"
                  title="Reset zoom"
                >
                  {Math.round(previewZoom * 100)}%
                </button>
                <button
                  onClick={zoomIn}
                  className="text-white hover:text-gray-200 text-sm px-2 py-1 rounded border border-white/30"
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={closePreview}
                  className="text-white hover:text-gray-200 text-sm px-3 py-1 rounded border border-white/30"
                >
                  Close
                </button>
              </div>
            </div>
            <div
              ref={previewBodyRef}
              className="relative flex-1 min-h-0 overflow-hidden rounded bg-black/20"
              onWheel={(e) => {
                if (!e.ctrlKey) return;
                e.preventDefault();
                if (e.deltaY < 0) zoomIn();
                else zoomOut();
              }}
            >
              <div className="w-full h-full flex items-center justify-center px-24">
                <button
                  onClick={() => { void showPrev(); }}
                  disabled={!canGoPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-black/45 border border-white/30 text-white text-4xl leading-none flex items-center justify-center hover:bg-black/65 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  title="Previous image"
                  aria-label="Previous image"
                >
                  {'<'}
                </button>
                <button
                  onClick={() => { void showNext(); }}
                  disabled={!canGoNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-black/45 border border-white/30 text-white text-4xl leading-none flex items-center justify-center hover:bg-black/65 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  title="Next image"
                  aria-label="Next image"
                >
                  {'>'}
                </button>

                <div
                  ref={previewViewportRef}
                  className="max-w-[86vw] max-h-[76vh] w-full h-full overflow-hidden rounded flex items-center justify-center"
                >
                  <div
                    onMouseDown={startPan}
                    className={previewZoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}
                    style={{
                      width: renderedLayout.width ? `${renderedLayout.width}px` : undefined,
                      height: renderedLayout.height ? `${renderedLayout.height}px` : undefined,
                      transform: `translate(${previewPan.x}px, ${previewPan.y}px)`,
                    }}
                  >
                    <img
                      src={previewUrl}
                      alt={previewName}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setPreviewNaturalSize({
                          width: img.naturalWidth || 0,
                          height: img.naturalHeight || 0,
                        });
                      }}
                      className="w-full h-full object-contain rounded select-none"
                      style={{
                        transform: `scale(${renderedLayout.detailScale})`,
                        transformOrigin: 'center center',
                      }}
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LazyThumbnail: React.FC<{
  attachmentId: number;
  fileName: string;
  fetchThumbnail: (attachmentId: number) => Promise<string | null>;
}> = ({ attachmentId, fileName, fetchThumbnail }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!inView || thumbUrl) return;
    fetchThumbnail(attachmentId).then((url) => {
      if (!cancelled && url) setThumbUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [inView, thumbUrl, attachmentId, fetchThumbnail]);

  React.useEffect(() => {
    return () => {
      if (thumbUrl) window.URL.revokeObjectURL(thumbUrl);
    };
  }, [thumbUrl]);

  return (
    <div
      ref={containerRef}
      className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 border border-gray-300 shrink-0 flex items-center justify-center"
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={fileName}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )}
    </div>
  );
};

