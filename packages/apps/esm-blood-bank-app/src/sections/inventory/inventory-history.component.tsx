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
import { normalizeSearch, ProcessingTable, type ProcessingTranslate } from '../../shared/processing-page.component';
import { printDocument } from '../../shared/print-document';
import { FractionationContent } from '../laboratory/fractionation/fractionation-content.component';
import { DisposalAct, QualitySeals } from './inventory-documents.component';
import type { InventoryOperation } from './inventory.types';
import { inventoryDisplayDate } from './inventory-rules';
import shared from '../applicant-selection/selection.scss';
import styles from './inventory.scss';

export function InventoryHistory({
  operations,
  onClose,
  onResume,
  t,
}: {
  operations: InventoryOperation[];
  onClose: () => void;
  onResume: (operation: InventoryOperation) => void;
  t: ProcessingTranslate;
}) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [detail, setDetail] = useState<InventoryOperation | null>(null);
  const [printFailed, setPrintFailed] = useState(false);
  const filtered = operations
    .filter(
      (op) =>
        (!kind || op.kind === kind) &&
        normalizeSearch(`${op.id} ${op.serviceResponsible} ${op.units.map((unit) => unit.id).join(' ')}`).includes(
          normalizeSearch(search),
        ),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <ComposedModal
      open
      size="lg"
      className={shared.workflow}
      preventCloseOnClickOutside
      aria-label={t('inventoryHistory')}
      onClose={onClose}
    >
      <ModalHeader title={t('inventoryHistory')} iconDescription={t('close')} closeModal={onClose} />
      <ModalBody>
        <FractionationContent>
          {detail ? (
            <>
              <Button
                kind="ghost"
                size="sm"
                className={styles.back}
                onClick={() => {
                  setDetail(null);
                  setPrintFailed(false);
                }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {t('backToHistory')}
              </Button>
              {printFailed && <InlineNotification hideCloseButton kind="error" title={t('printFailed')} />}
              {detail.kind === 'qualitySeal' ? (
                <QualitySeals operation={detail} t={t} />
              ) : (
                <DisposalAct operation={detail} t={t} />
              )}
            </>
          ) : (
            <>
              <div className={styles.toolbar}>
                <Search
                  id="inventory-history-search"
                  labelText={t('search')}
                  placeholder={t('inventoryHistorySearch')}
                  value={search}
                  closeButtonLabelText={t('clearSearch')}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select
                  id="inventory-history-kind"
                  labelText={t('inventoryOperationType')}
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                >
                  <SelectItem value="" text={t('inventoryAllOperations')} />
                  <SelectItem value="qualitySeal" text={t('inventoryQualitySeal')} />
                  <SelectItem value="disposal" text={t('inventoryDispose')} />
                </Select>
              </div>
              <ProcessingTable
                title={t('inventoryHistory')}
                columns={[
                  'inventoryOperation',
                  'inventoryOperationType',
                  'fractionationCode',
                  'inventoryDate',
                  'inventoryServiceResponsible',
                  'status',
                  'actions',
                ]}
                rows={filtered.map((op) => ({
                  id: op.id,
                  cells: [
                    op.id,
                    t(op.kind === 'qualitySeal' ? 'inventoryQualitySeal' : 'inventoryDispose'),
                    op.units.map((unit) => unit.id).join(', '),
                    `${inventoryDisplayDate(op.date)} ${op.time}`,
                    op.serviceResponsible || '—',
                    t(
                      op.stage === 'completed'
                        ? op.kind === 'disposal'
                          ? 'inventoryEliminated'
                          : 'inventorySuitable'
                        : `inventoryStage_${op.stage}`,
                    ),
                    <div key="actions">
                      <Button kind="ghost" size="sm" onClick={() => setDetail(op)}>
                        {t('inventoryView')}
                      </Button>
                      {op.stage !== 'completed' && (
                        <Button kind="ghost" size="sm" onClick={() => onResume(op)}>
                          {t('inventoryResume')}
                        </Button>
                      )}
                    </div>,
                  ],
                }))}
                loading={false}
                failed={false}
                reload={() => {}}
                emptyHelp={t('inventoryHistoryEmpty')}
                filterKey={`${search}:${kind}`}
                t={t}
              />
            </>
          )}
        </FractionationContent>
      </ModalBody>
      {detail?.kind === 'disposal' && detail.stage === 'completed' && (
        <ModalFooter className={`${shared.footer} ${styles.printFooter}`}>
          <div>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Printer}
              onClick={() => {
                setPrintFailed(false);
                try {
                  printDocument(<DisposalAct operation={detail} print t={t} />, t('inventoryActTitle'), () =>
                    setPrintFailed(true),
                  );
                } catch {
                  setPrintFailed(true);
                }
              }}
            >
              {t('inventoryPrintAct')}
            </Button>
          </div>
        </ModalFooter>
      )}
    </ComposedModal>
  );
}
