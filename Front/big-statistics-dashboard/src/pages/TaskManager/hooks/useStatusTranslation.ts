import { useTranslation } from 'react-i18next';

export const useStatusTranslation = () => {
  const { t } = useTranslation('taskManager');

  const translateStatus = (status: any) => {
    const systemStatusNames = ['Новая', 'В работе', 'Завершена', 'Отменена'];
    const isSystem = status?.is_system || systemStatusNames.includes(status?.name);

    if (status && isSystem && status.name) {
      const translated = t(`systemStatuses.${status.name}`);
      return translated !== `systemStatuses.${status.name}` ? translated : status.name;
    }
    return status?.name || '';
  };

  return { translateStatus };
};
