import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Search,
  Select,
  SelectItem,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useState } from 'react';
import { ProcessingTable, type ProcessingTranslate } from '../../../shared/processing-page.component';
import { printDocument } from '../../../shared/print-document';
import { matchesScreeningSearch, screeningCategory, screeningOriginLabel } from './screening-rules';
import { ScreeningReport } from './screening-report.component';
import type { ScreeningCategory, ScreeningRecord } from './screening.types';
import styles from '../../applicant-selection/selection.scss';
import screeningStyles from './screening.scss';

export function ScreeningHistory({
  category,
  records,
  loading,
  failed,
  reload,
  onClose,
  t,
}: {
  category: ScreeningCategory;
  records: ScreeningRecord[];
  loading: boolean;
  failed: boolean;
  reload: () => void;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [detail, setDetail] = useState<ScreeningRecord | null>(null);
  const [printFailed, setPrintFailed] = useState(false);
  const title = `${t('reportHistory')} — ${t(category === 'donors' ? 'donorSamples' : 'followUpSamples')}`;
  const filtered = records
    .filter(
      (record) =>
        screeningCategory(record) === category &&
        record.status === 'validated' &&
        (!result || record.result === result) &&
        matchesScreeningSearch(record, search),
    )
    .sort((left, right) => (right.validatedAt ?? '').localeCompare(left.validatedAt ?? ''));
  return (
    <ComposedModal
      open
      size="lg"
      className={styles.workflow}
      aria-label={title}
      onClose={onClose}
      preventCloseOnClickOutside
    >
      <ModalHeader title={title} iconDescription={t('close')} closeModal={onClose} />
      <ModalBody>
        {detail ? (
          <>
            <Button
              kind="ghost"
              onClick={() => {
                setDetail(null);
                setPrintFailed(false);
              }}
            >
              {t('backToHistory')}
            </Button>
            {printFailed && <InlineNotification hideCloseButton kind="error" title={t('printFailed')} />}
            <ScreeningReport record={detail} t={t} />
          </>
        ) : (
          <>
            <div className={screeningStyles.toolbar}>
              <Search
                id="screening-history-search"
                labelText={t('searchReports')}
                placeholder={t('screeningSearchPlaceholder')}
                value={search}
                closeButtonLabelText={t('clearSearch')}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                id="screening-history-result"
                labelText={t('globalResult')}
                value={result}
                onChange={(event) => setResult(event.target.value)}
              >
                <SelectItem value="" text={t('allResults')} />
                {['nonReactive', 'reactive', 'inconclusive'].map((value) => (
                  <SelectItem key={value} value={value} text={t(value)} />
                ))}
              </Select>
            </div>
            <ProcessingTable
              title={title}
              columns={[
                'sampleCode',
                'sampleOrigin',
                category === 'followUps' ? 'person' : 'applicant',
                'document',
                'validatedAt',
                'globalResult',
                'actions',
              ]}
              rows={filtered.map((record) => ({
                id: record.id,
                cells: [
                  record.sampleCode,
                  t(screeningOriginLabel(record)),
                  record.applicantName,
                  record.documentNumber,
                  record.validatedAt,
                  t(record.result || 'pendingResult'),
                  <Button key="detail" kind="ghost" size="sm" onClick={() => setDetail(record)}>
                    {t('viewResults')}
                  </Button>,
                ],
              }))}
              loading={loading}
              failed={failed}
              reload={reload}
              emptyHelp={t('emptyReports')}
              filterKey={`${search}:${result}`}
              t={t}
            />
          </>
        )}
      </ModalBody>
      {detail && (
        <ModalFooter className={styles.footer}>
          <div>
            <Button
              kind="tertiary"
              renderIcon={Printer}
              onClick={() => {
                try {
                  printDocument(<ScreeningReport record={detail} t={t} />, t('results'));
                  setPrintFailed(false);
                } catch {
                  setPrintFailed(true);
                }
              }}
            >
              {t('printResults')}
            </Button>
          </div>
        </ModalFooter>
      )}
    </ComposedModal>
  );
}
