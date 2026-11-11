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
import { matchesScreeningSearch, screeningCategory, screeningOriginLabel } from './screening-rules';
import { consolidatedScreening, pendingScreeningRepeatTests, screeningReportCode } from './screening-repeat-rules';
import { ScreeningReport } from './screening-report.component';
import { printScreeningAnalysis } from './screening-analysis-document.component';
import type { ScreeningCategory, ScreeningRecord, ScreeningRepeatRound } from './screening.types';
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
  const [detail, setDetail] = useState<{ record: ScreeningRecord; round?: ScreeningRepeatRound } | null>(null);
  const [currentView, setCurrentView] = useState(false);
  const [printFailed, setPrintFailed] = useState(false);
  const title = `${t('reportHistory')} - ${t(category === 'donors' ? 'donorSamples' : 'followUpSamples')}`;
  const reports = records
    .filter((record) => screeningCategory(record) === category && record.status === 'validated')
    .flatMap((record) => [
      { record, round: undefined, id: record.id, date: record.validatedAt, result: record.result },
      ...(record.repeatRounds ?? [])
        .filter((round) => round.status === 'validated')
        .map((round) => ({
          record,
          round,
          id: round.id,
          date: round.validatedAt,
          result: consolidatedScreening(record, round.number).result,
        })),
    ])
    .filter(
      (report) =>
        (!result || report.result === result) &&
        (matchesScreeningSearch(report.record, search) ||
          screeningReportCode(report.record, report.round?.number).toLowerCase().includes(search.trim().toLowerCase())),
    )
    .sort(
      (left, right) =>
        (right.date ?? '').localeCompare(left.date ?? '') || (right.round?.number ?? 1) - (left.round?.number ?? 1),
    );
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
                setCurrentView(false);
                setPrintFailed(false);
              }}
            >
              {t('backToHistory')}
            </Button>
            {detail.record.repeatRounds?.some((round) => round.status === 'validated') && (
              <Button kind="ghost" onClick={() => setCurrentView((value) => !value)}>
                {t(currentView ? 'screeningBackToReport' : 'screeningViewCurrent')}
              </Button>
            )}
            {printFailed && <InlineNotification hideCloseButton kind="error" title={t('printFailed')} />}
            {currentView && pendingScreeningRepeatTests(detail.record).length > 0 && (
              <InlineNotification hideCloseButton kind="warning" title={t('screeningRepeatPending')} />
            )}
            <ScreeningReport
              record={detail.record}
              round={currentView ? undefined : detail.round}
              current={currentView}
              t={t}
            />
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
                'screeningReportNumber',
                'sampleOrigin',
                category === 'followUps' ? 'person' : 'applicant',
                'document',
                'validatedAt',
                'globalResult',
                'actions',
              ]}
              rows={reports.map(({ record, round, id, date, result }) => ({
                id,
                cells: [
                  record.sampleCode,
                  <span key="report">
                    {round
                      ? t('screeningRepeatNumber', { number: String(round.number - 1) })
                      : t('screeningInitialReport')}
                    <br />
                    {screeningReportCode(record, round?.number)}
                  </span>,
                  t(screeningOriginLabel(record)),
                  record.applicantName,
                  record.documentNumber,
                  date,
                  t(result || 'pendingResult'),
                  <Button key="detail" kind="ghost" size="sm" onClick={() => setDetail({ record, round })}>
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
      {detail && !currentView && (
        <ModalFooter className={styles.footer}>
          <div>
            <Button
              kind="tertiary"
              renderIcon={Printer}
              onClick={() => {
                try {
                  setPrintFailed(false);
                  printScreeningAnalysis(detail.record, t, () => setPrintFailed(true), detail.round);
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
