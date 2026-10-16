import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import spanish from '../../../translations/es.json';
import { moduleName } from '../../constants';
import { useProcessingTranslation } from '../../shared/processing-page.component';

export function useTransfersTranslation() {
  const { t } = useTranslation(moduleName);
  const common = useProcessingTranslation();
  return useCallback(
    (key: string) =>
      key in spanish.transfer
        ? String(t(`transfer.${key}`, (spanish.transfer as Record<string, string>)[key]))
        : common(key),
    [t, common],
  );
}
