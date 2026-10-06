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
import { ArrowLeft, Printer } from '@carbon/react/icons';
import { useState } from 'react';
import { normalizeSearch, ProcessingTable, type ProcessingTranslate } from '../../../shared/processing-page.component';
import { printDocument } from '../../../shared/print-document';
import { FractionationLabels, FractionationReview } from './fractionation-documents.component';
import { FractionationContent } from './fractionation-content.component';
import { fractionationDateTime } from './fractionation-format';
import { componentDefinitions, finalNodes } from './fractionation-rules';
import type { FractionationBatch } from './fractionation.types';
import shared from '../../applicant-selection/selection.scss';
import styles from './fractionation.scss';

export function FractionationHistory({
  batches,
  loading,
  failed,
  reload,
  onClose,
  t,
}: {
  batches: FractionationBatch[];
  loading: boolean;
  failed: boolean;
  reload: () => void;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState<FractionationBatch | null>(null);
  const [printFailed, setPrintFailed] = useState(false);
  const filtered = batches
    .filter(
      (batch) =>
        (!status || batch.status === status) &&
        normalizeSearch(
          `${batch.id} ${batch.operator} ${batch.sources.map((source) => `${source.code} ${source.originalWholeBloodCode}`).join(' ')} ${batch.nodes.map((node) => node.code).join(' ')}`,
        ).includes(normalizeSearch(search)),
    )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  return (
    <ComposedModal
      open
      size="lg"
      className={shared.workflow}
      preventCloseOnClickOutside
      aria-label={t('fractionationHistory')}
      onClose={onClose}
    >
      <ModalHeader title={t('fractionationHistory')} iconDescription={t('close')} closeModal={onClose} />
      <ModalBody>
        <FractionationContent>
          {detail ? (
            <>
              <Button
                kind="ghost"
                size="sm"
                className={styles.backToHistory}
                onClick={() => {
                  setDetail(null);
                  setPrintFailed(false);
                }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {t('backToHistory')}
              </Button>
              {printFailed && <InlineNotification hideCloseButton kind="error" title={t('printFailed')} />}
              <FractionationReview batch={detail} t={t} />
            </>
          ) : (
            <>
              <div className={styles.toolbar}>
                <Search
                  id="fractionation-history-search"
                  labelText={t('search')}
                  placeholder={t('fractionationSearch')}
                  value={search}
                  closeButtonLabelText={t('clearSearch')}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select
                  id="fractionation-history-state"
                  labelText={t('status')}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <SelectItem value="" text={t('allStatuses')} />
                  <SelectItem value="inProgress" text={t('inProgress')} />
                  <SelectItem value="completed" text={t('completed')} />
                </Select>
              </div>
              <ProcessingTable
                title={t('fractionationHistory')}
                columns={[
                  'fractionationProcess',
                  'fractionationSource',
                  'fractionationStartedAt',
                  'fractionationCompletedAt',
                  'fractionationOperator',
                  'fractionationResults',
                  'status',
                  'actions',
                ]}
                rows={filtered.map((batch) => ({
                  id: batch.id,
                  cells: [
                    batch.id,
                    batch.sources.map((unit) => unit.code).join(', '),
                    fractionationDateTime(batch.startedAt),
                    fractionationDateTime(batch.completedAt),
                    batch.operator || '—',
                    finalNodes(batch)
                      .map((node) => t(componentDefinitions[node.component].key))
                      .join(', '),
                    t(batch.status),
                    <Button key="detail" kind="ghost" size="sm" onClick={() => setDetail(batch)}>
                      {t('fractionationView')}
                    </Button>,
                  ],
                }))}
                loading={loading}
                failed={failed}
                reload={reload}
                emptyHelp={t('fractionationEmptyHistory')}
                filterKey={`${search}:${status}`}
                t={t}
              />
            </>
          )}
        </FractionationContent>
      </ModalBody>
      {detail?.status === 'completed' && (
        <ModalFooter className={shared.footer}>
          <div>
            <Button
              kind="tertiary"
              renderIcon={Printer}
              onClick={() => {
                try {
                  printDocument(<FractionationLabels batch={detail} actual t={t} />, t('fractionationPrint'));
                  setPrintFailed(false);
                } catch {
                  setPrintFailed(true);
                }
              }}
            >
              {t('fractionationPrint')}
            </Button>
          </div>
        </ModalFooter>
      )}
    </ComposedModal>
  );
}
