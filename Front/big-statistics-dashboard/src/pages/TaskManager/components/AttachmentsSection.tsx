import React, { useState, useRef } from 'react';
import { useAttachments } from '../hooks/useAttachments';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface AttachmentsSectionProps {
  taskId: number;
  currentUserId: number;
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
  const { attachments, loading, uploading, error, uploadFile, downloadFile, deleteAttachment } = useAttachments(taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

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

  if (loading && attachments.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 text-sm">Загрузка файлов...</div>
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
          {uploading ? 'Загрузка...' : 'Перетащите файлы сюда или'}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          выберите с компьютера
        </button>
      </div>

      {/* Список файлов */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Загруженные файлы ({attachments.length})</h4>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              {/* Иконка файла */}
              {getFileIcon(attachment.mime_type)}

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
                <button
                  onClick={() => downloadFile(attachment.id, attachment.file_name)}
                  className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Скачать"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {attachment.uploaded_by === currentUserId && (
                  <button
                    onClick={async () => {
                      if (confirm('Удалить файл?')) {
                        await deleteAttachment(attachment.id);
                        // Счетчик обновится автоматически через useEffect
                      }
                    }}
                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Удалить"
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
    </div>
  );
};

