import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskFieldValues } from '../hooks/useCustomFields';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface CustomFieldsRendererProps {
  taskId: number;
  onValuesChange?: (values: Record<number, string>) => void;
}

export const CustomFieldsRenderer: React.FC<CustomFieldsRendererProps> = ({ taskId, onValuesChange }) => {
  const { t, i18n } = useTranslation('taskManager');
  const { fieldValues } = useTaskFieldValues(taskId);
  const [localValues, setLocalValues] = useState<Record<number, string>>({});

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  useEffect(() => {
    // Инициализируем локальные значения
    const initial: Record<number, string> = {};
    fieldValues.forEach(fv => {
      initial[fv.field_id] = fv.value || '';
    });
    setLocalValues(initial);
    
    // Уведомляем родителя о начальных значениях
    if (onValuesChange) {
      onValuesChange(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldValues]);

  const handleValueChange = (fieldId: number, value: string) => {
    // Обновляем локальное состояние
    const newValues = { ...localValues, [fieldId]: value };
    setLocalValues(newValues);
    
    // Уведомляем родителя об изменениях
    if (onValuesChange) {
      onValuesChange(newValues);
    }
  };

  const renderField = (field: any) => {
    const value = localValues[field.field_id] || '';

    switch (field.field_type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(field.field_id, e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder={field.is_required ? 'Обязательное поле' : ''}
            required={field.is_required}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(field.field_id, e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder={field.is_required ? 'Обязательное поле' : ''}
            required={field.is_required}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleValueChange(field.field_id, e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            required={field.is_required}
          />
        );

      case 'select':
        const options = field.field_options ? JSON.parse(field.field_options) : [];
        return (
          <select
            value={value}
            onChange={(e) => handleValueChange(field.field_id, e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            required={field.is_required}
          >
            <option value="">Выберите вариант</option>
            {options.map((option: string, idx: number) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => {
                const newValue = e.target.checked ? 'true' : 'false';
                handleValueChange(field.field_id, newValue);
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Да</span>
          </label>
        );

      default:
        return null;
    }
  };

  if (fieldValues.length === 0) {
    return null; // Не показываем секцию если нет полей
  }

  return (
    <div className="space-y-4 pt-4 border-t">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {t('taskModalAdditionalFields')}
      </h4>
      {fieldValues.map((field) => (
        <div key={field.field_id}>
          <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
            {field.field_name}
            {field.is_required && <span className="text-red-600 ml-1">*</span>}
          </label>
          {renderField(field)}
        </div>
      ))}
    </div>
  );
};

