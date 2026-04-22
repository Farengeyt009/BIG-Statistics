import { useTranslation } from 'react-i18next';

export const useErrorTranslation = () => {
  const { t } = useTranslation('taskManager');

  const translateError = (errorMessage: string) => {
    // Простые ключи
    const simpleKeys = [
      'uploadFileRequired',
      'insufficientUser',
      'transitionNotAllowed',
      'transitionAlreadyExists',
      'noProjectAccess',
      'viewerCannotCreate',
      'viewerCannotEdit',
      'onlyOwnerAdminCanDelete',
      'noInitialStatus',
      'taskNotFound',
      'statusEditRestricted',
      'cannotCreateInStatus',
    ];
    
    if (simpleKeys.includes(errorMessage)) {
      return t(`validation.${errorMessage}`);
    }
    
    // Ключи с параметрами
    if (errorMessage.startsWith('insufficientRole:')) {
      const roles = errorMessage.split(':')[1];
      return t('validation.insufficientRole', { roles });
    }
    
    if (errorMessage.startsWith('insufficientApprovals:')) {
      const parts = errorMessage.split(':');
      const required = parts[1];
      const current = parts[2];
      return t('validation.insufficientApprovals', { required, current });
    }

    if (errorMessage.startsWith('requiredFieldsMissing:')) {
      const fields = errorMessage.split(':')[1];
      return t('validation.requiredFieldsMissing', { fields });
    }
    
    return errorMessage;
  };

  return { translateError };
};

