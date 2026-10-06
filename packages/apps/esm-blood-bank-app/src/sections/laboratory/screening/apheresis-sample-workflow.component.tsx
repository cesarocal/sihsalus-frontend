import { Button, Search, Tag } from '@carbon/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScreeningApi } from '../../../api/blood-bank-processing.api';
import { ProcessingModal } from '../../../shared/processing-modal.component';
import {
  normalizeSearch,
  ProcessingTable,
  useProcessingData,
  type ProcessingTranslate,
} from '../../../shared/processing-page.component';
import { notifySuccess } from '../../../shared/notify-success';
import { printDocument } from '../../../shared/print-document';
import { ScreeningIdentity } from './screening-report.component';
import { ApheresisCandidateReview, ApheresisTubeLabel } from './apheresis-documents.component';
import type { ApheresisCandidate, ApheresisDraft, ScreeningRecord } from './screening.types';
import styles from '../../applicant-selection/selection.scss';

const steps = ['findApplication', 'reviewApplication', 'sampleLabel'] as const;
export function ApheresisSampleWorkflow({
  api,
  t,
  onClose,
  onRegistered,
}: {
  api: ScreeningApi;
  t: ProcessingTranslate;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const load = useCallback(async () => {
    const [candidates, draft] = await Promise.all([api.listApheresisCandidates(), api.getApheresisDraft()]);
    return { candidates, draft };
  }, [api]);
  const { data, loading, failed: loadFailed, reload } = useProcessingData(load);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApheresisCandidate | null>(null);
  const [draft, setDraft] = useState<ApheresisDraft | null>(null);
  const [sample, setSample] = useState<ScreeningRecord | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState('');
  const busy = useRef(false);
  useEffect(() => {
    if (!data) return;
    setDraft(data.draft);
    const candidate = data.candidates.find(
      (item) =>
        item.applicationId === data.draft?.candidate.applicationId &&
        item.applicationRevision === data.draft.candidate.applicationRevision,
    );
    setSelected(candidate ?? null);
    setStep(candidate ? 1 : 0);
  }, [data]);
  const unchanged =
    !!selected &&
    selected.applicationId === draft?.candidate.applicationId &&
    selected.applicationRevision === draft.candidate.applicationRevision;
  const saveDraft = async () => {
    if (unchanged) return true;
    if (!selected || loading || loadFailed || busy.current) return false;
    busy.current = true;
    setSaving(true);
    setFailed('');
    try {
      const saved = await api.saveApheresisDraft(selected, draft?.revision ?? 0);
      setDraft(saved);
      setSelected(saved.candidate);
      notifySuccess(t('apheresisDraftSaved'));
      return true;
    } catch {
      setFailed('apheresisSaveFailed');
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const advance = async () => {
    if (sample) {
      setStep(Math.min(step + 1, 2));
      return;
    }
    if (step === 0) {
      if (await saveDraft()) setStep(1);
      return;
    }
    if (!draft || !unchanged || busy.current) return;
    busy.current = true;
    setSaving(true);
    setFailed('');
    try {
      const registered = await api.registerApheresisSample(draft);
      setSample(registered);
      setStep(2);
      notifySuccess(t('apheresisSampleRegistered'));
      onRegistered();
    } catch {
      setFailed('apheresisSaveFailed');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const candidates = (data?.candidates ?? []).filter((item) =>
    normalizeSearch(
      `${item.applicationNumber} ${item.applicantName} ${item.documentNumber} ${item.donorCode}`,
    ).includes(normalizeSearch(search.trim())),
  );
  return (
    <ProcessingModal
      title={t('registerApheresisSample')}
      steps={steps}
      step={step}
      completed={sample ? [...steps] : draft ? ['findApplication'] : []}
      finalized={!!sample}
      saving={saving}
      errors={[]}
      failed={failed}
      saveErrorText={t('apheresisSaveFailed')}
      onClose={onClose}
      onDraft={saveDraft}
      onSaveBeforeExit={async () => {
        if (loading || loadFailed) return 'failed';
        if (!selected || unchanged) return 'unchanged';
        return (await saveDraft()) ? 'saved' : 'failed';
      }}
      onAdvance={() => {
        void advance();
      }}
      onPrevious={() => setStep(Math.max(0, step - 1))}
      advanceLabel={t(step === 1 && !sample ? 'confirmSample' : 'next')}
      advanceDisabled={!sample && (!selected || loading || loadFailed)}
      extraActions={
        step === 2 &&
        sample && (
          <Button
            kind="tertiary"
            disabled={saving}
            onClick={() => {
              try {
                printDocument(<ApheresisTubeLabel record={sample} t={t} />, t('sampleLabel'));
                setFailed('');
              } catch {
                setFailed('printFailed');
              }
            }}
          >
            {t('printSample')}
          </Button>
        )
      }
      t={t}
    >
      {step === 0 && !sample && (
        <>
          <Search
            id="apheresis-candidate-search"
            labelText={t('searchApplications')}
            placeholder={t('applicationSearchPlaceholder')}
            value={search}
            closeButtonLabelText={t('clearSearch')}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ProcessingTable
            title={t('findApplication')}
            columns={['number', 'applicant', 'document', 'actions']}
            rows={candidates.map((candidate) => ({
              id: candidate.applicationId,
              cells: [
                candidate.applicationNumber,
                candidate.applicantName,
                candidate.documentNumber,
                selected?.applicationId === candidate.applicationId ? (
                  <Tag key="selected" type="blue">
                    {t('applicationAssociated')}
                  </Tag>
                ) : (
                  <Button
                    key="select"
                    kind="ghost"
                    size="sm"
                    onClick={() => {
                      setSelected(candidate);
                      setFailed('');
                    }}
                  >
                    {t('associateApplication')}
                  </Button>
                ),
              ],
            }))}
            loading={loading}
            failed={loadFailed}
            reload={reload}
            emptyHelp={t('emptyApheresisCandidates')}
            filterKey={search}
            t={t}
          />
        </>
      )}
      {(step === 1 || (step === 0 && sample)) && selected && (
        <>
          <ApheresisCandidateReview candidate={selected} t={t} />
          <p className={styles.help}>{t('apheresisReviewHelp')}</p>
        </>
      )}
      {step === 2 && sample && (
        <>
          <ScreeningIdentity record={sample} t={t} />
          <p className={styles.help}>{t('sampleRegisteredHelp')}</p>
        </>
      )}
    </ProcessingModal>
  );
}
