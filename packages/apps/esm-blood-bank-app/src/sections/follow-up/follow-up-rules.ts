import { isDate } from '../applicant-selection/selection-rules';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { ScreeningRecord } from '../laboratory/screening/screening.types';
import type { FollowUpCase, FollowUpKind, FollowUpPerson, FollowUpSubject, FollowUpTrace } from './follow-up.types';

export const emptyFollowUpPerson = (): FollowUpPerson => ({
  id: '',
  name: '',
  document: '',
  history: '',
  age: '',
  sex: '',
  address: '',
  phone: '',
  mobile: '',
});
export function newFollowUp(kind: FollowUpKind): FollowUpCase {
  return {
    id: '',
    revision: 0,
    kind,
    status: 'open',
    stage: 0,
    createdAt: '',
    updatedAt: '',
    closedAt: '',
    detection: {
      person: emptyFollowUpPerson(),
      test: '',
      testedOn: '',
      reagent: '',
      brand: '',
      lot: '',
      confirmed: false,
      confirmationReference: '',
      reportedBy: '',
      treatingDoctor: '',
      notes: '',
    },
    traces: [],
    relatedTraces: [],
    subjects: [],
    responsible: '',
    reportDate: localDateTime().slice(0, 10),
    conclusion: '',
    informedDoctorOn: '',
    informedDirectorOn: '',
  };
}
export const tracePerson = (trace: FollowUpTrace, kind: FollowUpKind) =>
  kind === 'donor' ? trace.donor : trace.recipient;
export function subjectsForTraces(record: FollowUpCase, traces: FollowUpTrace[]): FollowUpSubject[] {
  const people = [
    ...new Map(
      traces.map((trace) => {
        const person = tracePerson(trace, record.kind);
        return [person.id, person];
      }),
    ).values(),
  ];
  return people.map((person) => ({
    ...(record.subjects.find((item) => item.person.id === person.id) ?? {
      person,
      notifiedOn: '',
      notifiedBy: '',
      method: '',
      collectedOn: localDateTime(),
      collectedBy: '',
      identityVerified: false,
      sampleId: '',
      confirmationReference: '',
      confirmedOn: '',
      confirmationResult: '',
      confirmationBy: '',
      informedOn: '',
      informedBy: '',
      referral: '',
    }),
    person,
  }));
}
export function followUpSample(subject: FollowUpSubject, samples: ScreeningRecord[]) {
  return samples.find((sample) => sample.id === subject.sampleId);
}
export function validFollowUpTime(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
    isDate(value.slice(0, 10)) &&
    Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    value <= localDateTime()
  );
}
export function validateFollowUp(record: FollowUpCase, stage: number, samples: ScreeningRecord[]): string[] {
  const d = record.detection;
  const errors: string[] = [];
  if (stage === 0) {
    if (
      !d.person.id ||
      !d.person.name.trim() ||
      !d.person.document.trim() ||
      !d.person.history.trim() ||
      !d.test.trim() ||
      !isDate(d.testedOn) ||
      d.testedOn > localDateTime().slice(0, 10) ||
      !d.reagent.trim() ||
      !d.brand.trim() ||
      !d.lot.trim() ||
      !d.reportedBy.trim() ||
      !d.treatingDoctor.trim()
    )
      errors.push('detectionRequired');
    if (record.kind === 'recipient' && (!d.confirmed || !d.confirmationReference.trim()))
      errors.push('triggerConfirmationRequired');
  }
  if (stage === 1 && !record.traces.length) errors.push('traceRequired');
  if (
    stage === 2 &&
    (!record.subjects.length ||
      record.subjects.some((s) => !validFollowUpTime(s.notifiedOn) || !s.notifiedBy.trim() || !s.method))
  )
    errors.push('notificationRequired');
  if (
    stage === 3 &&
    (!record.subjects.length ||
      record.subjects.some((s) => {
        const sample = followUpSample(s, samples);
        if (!sample || sample.status !== 'validated' || !sample.result) return true;
        return (
          (sample.result === 'reactive' || sample.result === 'inconclusive') &&
          (!s.confirmationReference.trim() ||
            !validFollowUpTime(s.confirmedOn) ||
            !s.confirmationResult ||
            !s.confirmationBy.trim())
        );
      }))
  )
    errors.push('testingRequired');
  if (stage === 4) {
    if (
      !record.responsible.trim() ||
      !record.conclusion.trim() ||
      !isDate(record.reportDate) ||
      record.reportDate > localDateTime().slice(0, 10) ||
      !validFollowUpTime(record.informedDoctorOn) ||
      (record.kind === 'donor' && !validFollowUpTime(record.informedDirectorOn)) ||
      record.subjects.some((s) => !validFollowUpTime(s.informedOn) || !s.informedBy.trim())
    )
      errors.push('informationRequired');
  }
  return errors;
}
