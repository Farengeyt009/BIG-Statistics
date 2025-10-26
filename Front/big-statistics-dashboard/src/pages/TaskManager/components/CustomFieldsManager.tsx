import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCustomFields } from '../hooks/useCustomFields';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface CustomFieldsManagerProps {
  projectId: number;
}

export const CustomFieldsManager: React.FC<CustomFieldsManagerProps> = ({ projectId }) => {
  const { t, i18n } = useTranslation('taskManager');
  const { fields, loading, createField, updateField, deleteField } = useCustomFields(projectId);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const fieldTypes = [
    { value: 'text', label: t('customFieldsText'), icon: '📝' },
    { value: 'number', label: t('customFieldsNumber'), icon: '🔢' },
    { value: 'date', label: t('customFieldsDate'), icon: '📅' },
    { value: 'select', label: t('customFieldsSelect'), icon: '📋' },
    { value: 'checkbox', label: t('customFieldsCheckbox'), icon: '☑️' },
  ];

  const handleCreateField = async () => {
    if (!newFieldName.trim()) {
      alert(t('customFieldsEnterFieldName'));
      return;
    }

    // Для select проверяем наличие опций
    if (newFieldType === 'select' && !newFieldOptions.trim()) {
      alert(t('customFieldsSelectOptionsRequired'));
      return;
    }

    const success = await createField({
      field_name: newFieldName,
      field_type: newFieldType,
      field_options: newFieldType === 'select' ? JSON.stringify(newFieldOptions.split(',').map(o => o.trim())) : null,
      is_required: newFieldRequired,
    });

    if (success) {
      setShowCreateModal(false);
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldOptions('');
      setNewFieldRequired(false);
    }
  };

  const toggleFieldActive = async (fieldId: number, currentActive: boolean) => {
    await updateField(fieldId, { is_active: !currentActive });
  };

  const startEdit = (field: any) => {
    setEditingField(field);
    setNewFieldName(field.field_name);
    setNewFieldType(field.field_type);
    setNewFieldOptions(
      field.field_options ? JSON.parse(field.field_options).join(', ') : ''
    );
    setNewFieldRequired(field.is_required);
  };

  const handleUpdateField = async () => {
    if (!newFieldName.trim()) {
      alert(t('customFieldsEnterFieldName'));
      return;
    }

    if (newFieldType === 'select' && !newFieldOptions.trim()) {
      alert(t('customFieldsSelectOptionsRequired'));
      return;
    }

    const success = await updateField(editingField.id, {
      field_name: newFieldName,
      field_options: newFieldType === 'select' ? JSON.stringify(newFieldOptions.split(',').map(o => o.trim())) : null,
      is_required: newFieldRequired,
    });

    if (success) {
      setEditingField(null);
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldOptions('');
      setNewFieldRequired(false);
    }
  };

  if (loading && fields.length === 0) {
    return <div className="text-center py-8 text-gray-500">{t('customFieldsLoading')}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t('customFieldsTitle')}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('customFieldsDescription')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + {t('customFieldsAddField')}
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-3">{t('customFieldsNoFields')}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {t('customFieldsCreateFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => {
            const fieldTypeInfo = fieldTypes.find(ft => ft.value === field.field_type);
            
            return (
              <div
                key={field.id}
                className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                  field.is_active
                    ? 'border-gray-200 bg-white hover:border-gray-300'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{fieldTypeInfo?.icon || '📄'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{field.field_name}</span>
                      {field.is_required && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                          {t('customFieldsRequired')}
                        </span>
                      )}
                      {!field.is_active && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded font-medium">
                          {t('customFieldsHidden')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {fieldTypeInfo?.label}
                      {field.field_type === 'select' && field.field_options && (
                        <span className="ml-2">
                          • {t('customFieldsOptions')} {JSON.parse(field.field_options).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(field)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title={t('customFieldsEdit')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleFieldActive(field.id, field.is_active)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      field.is_active
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {field.is_active ? t('customFieldsHide') : t('customFieldsShow')}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`${t('customFieldsDeleteConfirm')} "${field.field_name}"? ${t('customFieldsDeleteWarning')}`)) {
                        deleteField(field.id);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модалка создания/редактирования поля */}
      {(showCreateModal || editingField) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-xl font-semibold mb-4">
              {editingField ? t('customFieldsEditField') : t('customFieldsCreateField')}
            </h3>

            {/* Название */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('customFieldsFieldName')} *
              </label>
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder={t('customFieldsFieldNamePlaceholder')}
                autoFocus
              />
            </div>

            {/* Тип поля - только при создании */}
            {!editingField && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('customFieldsFieldType')} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {fieldTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setNewFieldType(type.value)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors ${
                        newFieldType === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{type.icon}</span>
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Варианты для select */}
            {newFieldType === 'select' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('customFieldsSelectOptions')} *
                </label>
                <input
                  type="text"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder={t('customFieldsSelectOptionsPlaceholder')}
                />
                <p className="text-xs text-gray-500 mt-1">{t('customFieldsCommaSeparated')}</p>
              </div>
            )}

            {/* Обязательное */}
            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t('customFieldsRequiredField')}
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                {t('customFieldsRequiredDesc')}
              </p>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingField(null);
                  setNewFieldName('');
                  setNewFieldType('text');
                  setNewFieldOptions('');
                  setNewFieldRequired(false);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                {t('customFieldsCancel')}
              </button>
              <button
                onClick={editingField ? handleUpdateField : handleCreateField}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingField ? t('customFieldsSave') : t('customFieldsCreate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

