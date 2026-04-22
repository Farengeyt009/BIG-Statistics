import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCustomFields } from '../hooks/useCustomFields';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface CustomFieldsManagerProps {
  projectId: number;
}

const FIELD_TYPES = [
  {
    value: 'text',
    icon: <span className="text-lg">📝</span>,
  },
  {
    value: 'number',
    icon: <span className="text-lg">🔢</span>,
  },
  {
    value: 'date',
    icon: <span className="text-lg">📅</span>,
  },
  {
    value: 'select',
    icon: <span className="text-lg">📋</span>,
  },
  {
    value: 'checkbox',
    icon: <span className="text-lg">☑️</span>,
  },
];

export const CustomFieldsManager: React.FC<CustomFieldsManagerProps> = ({ projectId }) => {
  const { t, i18n } = useTranslation('taskManager');
  const { fields, loading, createField, updateField, deleteField } = useCustomFields(projectId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldOptions, setFieldOptions] = useState('');

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const lang = i18n.language;
    if (TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(lang, 'taskManager', TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null); setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const resetForm = () => {
    setFieldName(''); setFieldType('text'); setFieldOptions('');
  };

  const openCreate = () => {
    setEditingField(null);
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (field: any) => {
    setEditingField(field);
    setFieldName(field.field_name);
    setFieldType(field.field_type);
    setFieldOptions(field.field_options ? JSON.parse(field.field_options).join(', ') : '');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingField(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!fieldName.trim()) { alert(t('customFieldsEnterFieldName')); return; }
    if (fieldType === 'select' && !fieldOptions.trim()) { alert(t('customFieldsSelectOptionsRequired')); return; }

    const payload = {
      field_name: fieldName,
      field_type: fieldType,
      field_options: fieldType === 'select' ? JSON.stringify(fieldOptions.split(',').map(o => o.trim())) : null,
    };

    const success = editingField
      ? await updateField(editingField.id, payload)
      : await createField(payload);

    if (success) closeDrawer();
  };

  if (loading && fields.length === 0) {
    return <div className="text-center py-8 text-gray-500">{t('customFieldsLoading')}</div>;
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-xl">

        {/* Fields list */}
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          {fields.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400 italic">{t('customFieldsNoFields')}</div>
          ) : (
            <div className="grid grid-cols-[auto_1fr_auto_auto]">

              {/* Header */}
              <div className="col-span-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center">
                <span className="text-sm font-semibold text-gray-700">{t('customFieldsTitle')}</span>
              </div>
              <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center">
                <span className="text-xs text-gray-400 font-medium">{t('customFieldsFieldType')}</span>
              </div>
              <div className="px-2 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-end">
                <button
                  onClick={openCreate}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('customFieldsAddField')}
                </button>
              </div>

              {/* Rows */}
              {fields.map((field, idx) => {
                const typeInfo = FIELD_TYPES.find(ft => ft.value === field.field_type);
                const isLast = idx === fields.length - 1;
                const borderCls = isLast ? '' : 'border-b border-gray-100';
                const opacityCls = !field.is_active ? 'opacity-50' : '';
                return (
                  <React.Fragment key={field.id}>
                    <div className={`col-span-2 pl-4 pr-0 py-2.5 flex items-center gap-2 ${borderCls} ${opacityCls} hover:bg-gray-50 transition-colors`}>
                      <span className="w-5 flex justify-center shrink-0">{typeInfo?.icon}</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate">{field.field_name}</span>
                        {!field.is_active && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded shrink-0">{t('customFieldsHidden')}</span>
                        )}
                      </div>
                    </div>
                    <div className={`px-3 py-2.5 flex items-center ${borderCls} ${opacityCls} hover:bg-gray-50 transition-colors`}>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full shrink-0">
                        {t(`customFields${field.field_type.charAt(0).toUpperCase() + field.field_type.slice(1)}`)}
                      </span>
                    </div>
                    <div className={`px-2 py-2.5 flex items-center justify-end ${borderCls} ${opacityCls} hover:bg-gray-50 transition-colors`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuId === field.id) { setOpenMenuId(null); setMenuPos(null); return; }
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setMenuPos({ top: rect.bottom + 4, left: rect.right - 128 });
                          setOpenMenuId(field.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/20" onClick={closeDrawer} />}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: 340 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            {editingField ? t('customFieldsEditField') : t('customFieldsCreateField')}
          </h3>
          <button onClick={closeDrawer} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('customFieldsFieldName')} *</label>
            <input
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') closeDrawer(); }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('customFieldsFieldNamePlaceholder')}
              autoFocus
            />
          </div>

          {/* Type — only on create */}
          {!editingField && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('customFieldsFieldType')} *</label>
              <div className="space-y-1.5">
                {FIELD_TYPES.map((type) => (
                  <label key={type.value} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                    fieldType === type.value
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="fieldType" value={type.value} checked={fieldType === type.value}
                      onChange={() => setFieldType(type.value)} className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-500">{type.icon}</span>
                    <span className="text-sm font-medium text-gray-800">
                      {t(`customFields${type.value.charAt(0).toUpperCase() + type.value.slice(1)}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Select options */}
          {fieldType === 'select' && (            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('customFieldsSelectOptions')} *</label>
              <input
                type="text"
                value={fieldOptions}
                onChange={(e) => setFieldOptions(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('customFieldsSelectOptionsPlaceholder')}
              />
              <p className="text-xs text-gray-400 mt-1">{t('customFieldsCommaSeparated')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex gap-2">
            <button onClick={closeDrawer} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              {t('customFieldsCancel')}
            </button>
            <button onClick={handleSave} disabled={!fieldName.trim()}
              className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {editingField ? t('customFieldsSave') : t('customFieldsCreate')}
            </button>
          </div>
        </div>
      </div>

      {/* Kebab menu */}
      {openMenuId !== null && menuPos && (
        <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-0.5">
          {(() => {
            const f = fields.find(x => x.id === openMenuId);
            return (
              <>
                <button onClick={(e) => { e.stopPropagation(); const fi = fields.find(x => x.id === openMenuId); setOpenMenuId(null); setMenuPos(null); if (fi) openEdit(fi); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t('customFieldsEdit')}
                </button>
                {f && (
                  <button onClick={async (e) => { e.stopPropagation(); const fi = fields.find(x => x.id === openMenuId); setOpenMenuId(null); setMenuPos(null); if (fi) await updateField(fi.id, { is_active: !fi.is_active }); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.is_active ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} />
                    </svg>
                    {f.is_active ? t('customFieldsHide') : t('customFieldsShow')}
                  </button>
                )}
                <div className="border-t border-gray-100 my-0.5" />
                <button onClick={async (e) => { e.stopPropagation(); const id = openMenuId; const fi = fields.find(x => x.id === id); setOpenMenuId(null); setMenuPos(null); if (confirm(`${t('customFieldsDeleteConfirm')} "${fi?.field_name}"?`)) deleteField(id); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('customFieldsDelete')}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
