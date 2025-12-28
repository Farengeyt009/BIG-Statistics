import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void;
};

export default function SalePlanUploadModal({ isOpen, onClose, onUploadSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Выберите файл для загрузки');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (comment) {
        formData.append('comment', comment);
      }

      const response = await fetch('/api/orders/saleplan/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult(data);
        setFile(null);
        setComment('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Закрываем модальное окно через 2 секунды после успеха
        setTimeout(() => {
          onClose();
          if (onUploadSuccess) onUploadSuccess();
        }, 2000);
      } else {
        setError(data.error || 'Ошибка при загрузке файла');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка соединения с сервером');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setComment('');
      setError(null);
      setResult(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#0d1c3d]">Upload Sale Plan</h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Описание */}
        <div className="mb-6 text-sm text-gray-600">
          Загрузите Excel файл с планом продаж.<br />
          <strong>Обязательные колонки:</strong> Year, Month, Market, Article_number, Name, QTY
        </div>

        {/* Блок загрузки */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4">
          <div className="flex flex-col items-center gap-4">
            <FileSpreadsheet className="w-12 h-12 text-gray-400" />
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="modal-file-upload"
            />

            <label
              htmlFor="modal-file-upload"
              className="px-6 py-2 bg-[#0d1c3d] text-white rounded-md hover:opacity-90 transition cursor-pointer"
            >
              Выбрать файл
            </label>

            {file && (
              <div className="w-full mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">{file.name}</span>
                    <span className="text-xs text-blue-600">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                    disabled={uploading}
                  >
                    Удалить
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Комментарий (опционально)
                  </label>
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Например: План на 2026 год, версия 2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={uploading}
                  />
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Загрузить в базу данных
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Результат */}
        {result && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-2">✅ Файл успешно загружен!</h4>
            <div className="text-sm text-green-800 space-y-1">
              <p><strong>Version ID:</strong> {result.version_id}</p>
              <p><strong>Записей:</strong> {result.total_records}</p>
              <p><strong>Период:</strong> {result.min_year} - {result.max_year}</p>
            </div>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-900 mb-2">❌ Ошибка</h4>
            <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

