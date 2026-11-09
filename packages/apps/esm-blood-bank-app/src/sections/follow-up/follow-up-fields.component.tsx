import { Button, Checkbox, Select, SelectItem, TextArea, TextInput, Tag } from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { ObservationsTextArea } from '../../shared/observations-text-area.component';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { followUpSample } from './follow-up-rules';
import type { FollowUpCase, FollowUpSubject, FollowUpWorkspace } from './follow-up.types';
import styles from './follow-up.scss';

export function FollowUpFields({
  record,
  workspace,
  step,
  readOnly,
  busy,
  onChange,
  onSample,
  onRefresh,
  t,
}: {
  record: FollowUpCase;
  workspace: FollowUpWorkspace;
  step: number;
  readOnly: boolean;
  busy: boolean;
  onChange: (record: FollowUpCase) => void;
  onSample: (id: string) => void;
  onRefresh: () => void;
  t: ProcessingTranslate;
}) {
  const donor = record.kind === 'donor';
  const detection = record.detection;
  const person = detection.person;
  const input = (key: string, value: string, change: (value: string) => void, type = 'text', locked = false) => (
    <TextInput
      id={`follow-up-${key}`}
      labelText={t(key)}
      value={value}
      type={type}
      readOnly={readOnly || locked}
      disabled={busy}
      onChange={(event) => change(event.target.value)}
    />
  );
  const updateDetection = (key: string, value: string) =>
    onChange({ ...record, detection: { ...detection, [key]: value } });
  const updatePerson = (key: string, value: string) =>
    onChange({
      ...record,
      detection: { ...detection, person: { ...person, [key]: value } },
    });
  const updateSubject = (subject: FollowUpSubject, key: string, value: string | boolean) =>
    onChange({
      ...record,
      subjects: record.subjects.map((s) => (s.person.id === subject.person.id ? { ...s, [key]: value } : s)),
    });
  if (step === 0)
    return (
      <>
        {!readOnly && (
          <Select
            id="follow-up-origin"
            labelText={t(donor ? 'selectRecipient' : 'selectDonor')}
            value={person.id}
            disabled={busy}
            onChange={(event) => {
              const candidate = workspace.candidates.find((c) => c.person.id === event.target.value);
              if (candidate)
                onChange({
                  ...record,
                  detection: structuredClone(candidate),
                  traces: [],
                  subjects: [],
                });
            }}
          >
            <SelectItem value="" text={t('chooseOrigin')} />
            {workspace.candidates.map((c) => (
              <SelectItem key={c.person.id} value={c.person.id} text={`${c.person.name} · ${c.person.document}`} />
            ))}
          </Select>
        )}
        <p className={styles.notice}>{t(donor ? 'donorTriggerHelp' : 'recipientTriggerHelp')}</p>
        <div className={styles.fields}>
          {input('originName', person.name, () => {}, 'text', true)}
          {input('documentNumber', person.document, () => {}, 'text', true)}
          {input('historyNumber', person.history, () => {}, 'text', true)}
          {input('age', person.age, (v) => updatePerson('age', v), 'number')}
          <Select
            id="follow-up-sex"
            labelText={t('sex')}
            value={person.sex}
            disabled={readOnly || busy}
            onChange={(event) => updatePerson('sex', event.target.value)}
          >
            <SelectItem value="" text={t('choose')} />
            <SelectItem value="male" text={t('male')} />
            <SelectItem value="female" text={t('female')} />
          </Select>
          {input('address', person.address, (v) => updatePerson('address', v))}
          {input('phone', person.phone, (v) => updatePerson('phone', v), 'tel')}
          {input('mobile', person.mobile, (v) => updatePerson('mobile', v), 'tel')}
          {(['test', 'testedOn', 'reagent', 'brand', 'lot', 'reportedBy', 'treatingDoctor'] as const).map((key) => (
            <div key={key}>
              {input(key, detection[key], (v) => updateDetection(key, v), key === 'testedOn' ? 'date' : 'text')}
            </div>
          ))}
        </div>
        {record.kind === 'recipient' && (
          <>
            <Checkbox
              id="trigger-confirmed"
              labelText={t('triggerConfirmed')}
              checked={detection.confirmed}
              disabled={readOnly || busy}
              onChange={(_, { checked }) =>
                onChange({
                  ...record,
                  detection: { ...detection, confirmed: checked },
                })
              }
            />
            {input('confirmationReference', detection.confirmationReference, (v) =>
              updateDetection('confirmationReference', v),
            )}
          </>
        )}
        <ObservationsTextArea
          id="follow-up-origin-notes"
          t={t}
          labelText={t('notes')}
          value={detection.notes}
          readOnly={readOnly}
          disabled={busy}
          onChange={(event) => updateDetection('notes', event.target.value)}
        />
      </>
    );
  if (step === 1) {
    const traces = readOnly
      ? record.traces
      : workspace.traces.filter((row) => (donor ? row.recipient.id : row.donor.id) === person.id);
    return (
      <>
        <p>{t(donor ? 'donorTracingHelp' : 'recipientTracingHelp')}</p>
        <div className={styles.table}>
          <table aria-label={t('traceTable')}>
            <thead>
              <tr>
                {!readOnly && <th>{t('select')}</th>}
                {['unitCode', 'component', 'donorName', 'recipientName', 'donationDate', 'transfusionDate'].map(
                  (key) => (
                    <th key={key}>{t(key)}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {traces.map((row) => (
                <tr key={row.id}>
                  {!readOnly && (
                    <td>
                      <Checkbox
                        id={`trace-${row.id}`}
                        labelText={`${t('selectUnit')} ${row.unit}`}
                        hideLabel
                        checked={record.traces.some((r) => r.id === row.id)}
                        disabled={busy}
                        onChange={(_, { checked }) =>
                          onChange({
                            ...record,
                            traces: checked ? [...record.traces, row] : record.traces.filter((r) => r.id !== row.id),
                          })
                        }
                      />
                    </td>
                  )}
                  <td>{row.unit}</td>
                  <td>{row.component}</td>
                  <td>{row.donor.name}</td>
                  <td>{row.recipient.name}</td>
                  <td>{row.donationDate.split('-').reverse().join('/')}</td>
                  <td>{row.transfusionDate.split('-').reverse().join('/')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!traces.length && <p>{t('noTraces')}</p>}
        {!donor &&
          record.traces.map((row) => (
            <div className={styles.panel} key={row.id}>
              <h4>
                {row.recipient.name} · {row.unit}
              </h4>
              <div className={styles.fields}>
                {(['previousHere', 'previousElsewhere'] as const).map((key) => (
                  <Select
                    id={`${row.id}-${key}`}
                    key={key}
                    labelText={t(key)}
                    value={row[key]}
                    disabled={readOnly || busy}
                    onChange={(event) =>
                      onChange({
                        ...record,
                        traces: record.traces.map((r) =>
                          r.recipient.id === row.recipient.id ? { ...r, [key]: event.target.value } : r,
                        ),
                      })
                    }
                  >
                    {['', 'yes', 'no', 'unknown'].map((value) => (
                      <SelectItem key={value} value={value} text={t(value || 'choose')} />
                    ))}
                  </Select>
                ))}
              </div>
            </div>
          ))}
      </>
    );
  }
  if (step === 2)
    return (
      <>
        <p>{t('notificationHelp')}</p>
        {record.subjects.map((s) => (
          <section className={styles.panel} key={s.person.id}>
            <h4>{s.person.name}</h4>
            <p>
              {s.person.document} · {s.person.history} · {s.person.mobile}
            </p>
            <div className={styles.fields}>
              <TextInput
                id={`notifiedOn-${s.person.id}`}
                labelText={t('notifiedOn')}
                type="datetime-local"
                value={s.notifiedOn}
                readOnly={readOnly}
                disabled={busy}
                onChange={(e) => updateSubject(s, 'notifiedOn', e.target.value)}
              />
              <TextInput
                id={`notifiedBy-${s.person.id}`}
                labelText={t('notifiedBy')}
                value={s.notifiedBy}
                readOnly={readOnly}
                disabled={busy}
                onChange={(e) => updateSubject(s, 'notifiedBy', e.target.value)}
              />
              <Select
                id={`method-${s.person.id}`}
                labelText={t('method')}
                value={s.method}
                disabled={readOnly || busy}
                onChange={(e) => updateSubject(s, 'method', e.target.value)}
              >
                {['', 'phone', 'inPerson', 'document'].map((key) => (
                  <SelectItem key={key} value={key} text={t(key || 'choose')} />
                ))}
              </Select>
            </div>
          </section>
        ))}
      </>
    );
  if (step === 3)
    return (
      <>
        <p>{t('testingHelp')}</p>
        <Button kind="ghost" size="sm" renderIcon={Renew} disabled={busy} onClick={onRefresh}>
          {t('refreshResults')}
        </Button>
        {record.subjects.map((s) => {
          const sample = followUpSample(s, workspace.screenings);
          const confirmation = sample?.status === 'validated' && ['reactive', 'inconclusive'].includes(sample.result);
          return (
            <section className={styles.panel} key={s.person.id}>
              <h4>{s.person.name}</h4>
              <p>
                {s.person.document} · {s.person.history}
              </p>
              <div className={styles.fields}>
                <TextInput
                  id={`collectedOn-${s.person.id}`}
                  labelText={t('collectedOn')}
                  type="datetime-local"
                  value={s.collectedOn}
                  readOnly={readOnly || !!s.sampleId}
                  disabled={busy}
                  onChange={(e) => updateSubject(s, 'collectedOn', e.target.value)}
                />
                <TextInput
                  id={`collectedBy-${s.person.id}`}
                  labelText={t('collectedBy')}
                  value={s.collectedBy}
                  readOnly={readOnly || !!s.sampleId}
                  disabled={busy}
                  onChange={(e) => updateSubject(s, 'collectedBy', e.target.value)}
                />
              </div>
              <Checkbox
                id={`identity-${s.person.id}`}
                checked={s.identityVerified}
                disabled={readOnly || busy || !!s.sampleId}
                labelText={t('identityVerified')}
                onChange={(_, { checked }) => updateSubject(s, 'identityVerified', checked)}
              />
              {sample ? (
                <>
                  <p>
                    {t('sampleCode')}: <strong>{sample.sampleCode}</strong>
                  </p>
                  <Tag type={sample.status === 'validated' ? 'green' : 'blue'}>
                    {t(sample.status === 'validated' ? sample.result : 'pendingResults')}
                  </Tag>
                  {sample.status === 'validated' && (
                    <div className={styles.table}>
                      <table aria-label={`${t('testResults')} · ${s.person.name}`}>
                        <thead>
                          <tr>
                            {['test', 'result', 'reagent', 'brand', 'lot'].map((key) => (
                              <th key={key}>{t(key)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(sample.tests).map(([key, value]) => (
                            <tr key={key}>
                              <td>{t(key)}</td>
                              <td>{t(value.result)}</td>
                              <td>{value.reagent}</td>
                              <td>{value.brand}</td>
                              <td>{value.lot}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                !readOnly && (
                  <Button kind="tertiary" size="sm" disabled={busy} onClick={() => onSample(s.person.id)}>
                    {t('registerSample')}
                  </Button>
                )
              )}
              {confirmation && (
                <>
                  <p>{t('confirmationHelp')}</p>
                  <div className={styles.fields}>
                    {(['confirmationReference', 'confirmedOn', 'confirmationBy'] as const).map((key) => (
                      <TextInput
                        key={key}
                        id={`${key}-${s.person.id}`}
                        labelText={t(key)}
                        type={key === 'confirmedOn' ? 'datetime-local' : 'text'}
                        value={s[key]}
                        readOnly={readOnly}
                        disabled={busy}
                        onChange={(e) => updateSubject(s, key, e.target.value)}
                      />
                    ))}
                    <Select
                      id={`confirmationResult-${s.person.id}`}
                      labelText={t('confirmationResult')}
                      value={s.confirmationResult}
                      disabled={readOnly || busy}
                      onChange={(e) => updateSubject(s, 'confirmationResult', e.target.value)}
                    >
                      {['', 'reactive', 'nonReactive'].map((key) => (
                        <SelectItem key={key} value={key} text={t(key || 'choose')} />
                      ))}
                    </Select>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </>
    );
  return (
    <>
      {record.subjects.map((s) => (
        <section className={styles.panel} key={s.person.id}>
          <h4>{s.person.name}</h4>
          <div className={styles.fields}>
            <TextInput
              id={`informedOn-${s.person.id}`}
              labelText={t('informedOn')}
              type="datetime-local"
              value={s.informedOn}
              readOnly={readOnly}
              disabled={busy}
              onChange={(e) => updateSubject(s, 'informedOn', e.target.value)}
            />
            <TextInput
              id={`informedBy-${s.person.id}`}
              labelText={t('informedBy')}
              value={s.informedBy}
              readOnly={readOnly}
              disabled={busy}
              onChange={(e) => updateSubject(s, 'informedBy', e.target.value)}
            />
          </div>
          <TextArea
            id={`referral-${s.person.id}`}
            labelText={t('referral')}
            value={s.referral}
            readOnly={readOnly}
            disabled={busy}
            onChange={(e) => updateSubject(s, 'referral', e.target.value)}
          />
        </section>
      ))}
      <div className={styles.fields}>
        {input('responsible', record.responsible, (v) => onChange({ ...record, responsible: v }))}
        {input('reportDate', record.reportDate, (v) => onChange({ ...record, reportDate: v }), 'date')}
        {input(
          'informedDoctorOn',
          record.informedDoctorOn,
          (v) => onChange({ ...record, informedDoctorOn: v }),
          'datetime-local',
        )}
        {donor &&
          input(
            'informedDirectorOn',
            record.informedDirectorOn,
            (v) => onChange({ ...record, informedDirectorOn: v }),
            'datetime-local',
          )}
      </div>
      <TextArea
        id="follow-up-conclusion"
        labelText={t('conclusion')}
        value={record.conclusion}
        readOnly={readOnly}
        disabled={busy}
        onChange={(e) => onChange({ ...record, conclusion: e.target.value })}
      />
    </>
  );
}
