import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import spanish from '../../../translations/es.json';
import { moduleName } from '../../constants';
import { useProcessingTranslation } from '../../shared/processing-page.component';

export function useFollowUpTranslation() {
  const { t } = useTranslation(moduleName);
  const common = useProcessingTranslation();
  return useCallback(
    (key: string) =>
      key in spanish.followUp
        ? String(t(`followUp.${key}`, (spanish.followUp as Record<string, string>)[key]))
        : common(key),
    [t, common],
  );
}
