import { followUpCandidates, followUpTraceFixtures } from '../mocks/follow-up.mock';
import {
  newFollowUp,
  subjectsForTraces,
  validFollowUpTime,
  validateFollowUp,
} from '../sections/follow-up/follow-up-rules';
import type { FollowUpCase, FollowUpKind } from '../sections/follow-up/follow-up.types';
import { newScreeningSample } from '../sections/laboratory/screening/screening-rules';
import { observationsExceedLimit } from '../shared/text-field-contracts';
import type { FollowUpApi } from './follow-up.api';
import {
  readProcessingState,
  writeProcessingState,
  type MockStorage,
  type ProcessingState,
} from './mock-processing-store';

export function createMockFollowUpApi(getStorage: () => MockStorage = () => globalThis.sessionStorage): FollowUpApi {
  const read = () => {
    const state = readProcessingState(getStorage);
    if (!state.followUps) {
      state.followUps = (['donor', 'recipient'] as const).map((kind) => ({
        ...newFollowUp(kind),
        id: `SEG-${kind === 'donor' ? 'D' : 'R'}-DEMO-0001`,
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        detection: structuredClone(followUpCandidates(kind)[0]),
      }));
    }
    return state;
  };
  const prepare = (state: ProcessingState, input: FollowUpCase) => {
    const previous = state.followUps?.find((c) => c.id === input.id);
    if (input.id && !previous) throw new Error('FOLLOW_UP_NOT_FOUND');
    if ((previous?.revision ?? 0) !== input.revision || previous?.status === 'closed')
      throw new Error('FOLLOW_UP_CONFLICT');
    if (previous && (previous.kind !== input.kind || previous.stage !== input.stage))
      throw new Error('FOLLOW_UP_STAGE_CONFLICT');
    if (input.stage < 0 || input.stage > 4 || (!previous && input.stage !== 0))
      throw new Error('FOLLOW_UP_STAGE_CONFLICT');
    if (input.stage === 0 && observationsExceedLimit(input.detection.notes))
      throw new Error('FOLLOW_UP_OBSERVATIONS_LIMIT');
    const record = structuredClone(input);
    record.status = 'open';
    record.closedAt = '';
    record.createdAt = previous?.createdAt ?? new Date().toISOString();
    const sequence =
      Math.max(
        0,
        ...(state.followUps ?? []).filter((c) => c.kind === input.kind).map((c) => Number(c.id.split('-').at(-1)) || 0),
      ) + 1;
    record.id ||= `SEG-${input.kind === 'donor' ? 'D' : 'R'}-${String(sequence).padStart(5, '0')}`;
    record.revision = (previous?.revision ?? 0) + 1;
    record.updatedAt = new Date().toISOString();
    if (record.detection.person.id) {
      const source = followUpCandidates(record.kind).find((c) => c.person.id === record.detection.person.id);
      if (
        !source ||
        ['id', 'name', 'document', 'history'].some(
          (key) =>
            source.person[key as keyof typeof source.person] !==
            record.detection.person[key as keyof typeof source.person],
        )
      )
        throw new Error('FOLLOW_UP_SOURCE_NOT_AVAILABLE');
    }
    // Completed stages are immutable. Drafts never bypass the stage gates.
    if (previous && input.stage > 0 && JSON.stringify(input.detection) !== JSON.stringify(previous.detection))
      throw new Error('FOLLOW_UP_DETECTION_LOCKED');
    if (previous && input.stage > 1 && JSON.stringify(input.traces) !== JSON.stringify(previous.traces))
      throw new Error('FOLLOW_UP_TRACING_LOCKED');
    const available = followUpTraceFixtures().filter(
      (row) => (record.kind === 'donor' ? row.recipient.id : row.donor.id) === record.detection.person.id,
    );
    record.traces = input.traces.map((row) => {
      const canonical = available.find((a) => a.id === row.id);
      if (!canonical) throw new Error('FOLLOW_UP_TRACE_NOT_AVAILABLE');
      return {
        ...canonical,
        previousHere: row.previousHere,
        previousElsewhere: row.previousElsewhere,
      };
    });
    if (new Set(record.traces.map((row) => row.id)).size !== record.traces.length)
      throw new Error('FOLLOW_UP_DUPLICATE_TRACE');
    record.relatedTraces =
      record.kind === 'donor'
        ? followUpTraceFixtures().filter((row) => record.traces.some((trace) => trace.donor.id === row.donor.id))
        : [];
    const canonicalSubjects = subjectsForTraces(record, record.traces);
    if (input.stage > 1) {
      record.subjects = canonicalSubjects.map((s) => {
        const edited = input.subjects.find((p) => p.person.id === s.person.id);
        const old = previous?.subjects.find((p) => p.person.id === s.person.id);
        if (!edited || edited.sampleId !== (old?.sampleId ?? '')) throw new Error('FOLLOW_UP_SAMPLE_CONFLICT');
        if (
          old &&
          input.stage > 2 &&
          ['notifiedOn', 'notifiedBy', 'method'].some(
            (key) => edited[key as keyof typeof edited] !== old[key as keyof typeof old],
          )
        )
          throw new Error('FOLLOW_UP_NOTIFICATION_LOCKED');
        if (
          old?.sampleId &&
          (edited.collectedOn !== old.collectedOn || edited.collectedBy !== old.collectedBy || !edited.identityVerified)
        )
          throw new Error('FOLLOW_UP_SAMPLE_LOCKED');
        return { ...edited, person: s.person };
      });
    } else record.subjects = canonicalSubjects;
    return record;
  };
  const commit = (state: ProcessingState, record: FollowUpCase) => {
    state.followUps = [record, ...(state.followUps ?? []).filter((c) => c.id !== record.id)];
    writeProcessingState(getStorage, state);
    return structuredClone(record);
  };
  return {
    async list(kind: FollowUpKind) {
      const state = read();
      const cases = state.followUps?.filter((c) => c.kind === kind) ?? [];
      const sampleIds = new Set(cases.flatMap((c) => c.subjects.map((s) => s.sampleId)));
      return structuredClone({
        cases,
        candidates: followUpCandidates(kind),
        traces: followUpTraceFixtures(),
        screenings: state.screenings.filter((s) => sampleIds.has(s.id)),
      });
    },
    async save(input, advance = false) {
      const state = read();
      const record = prepare(state, input);
      if (advance) {
        if (record.stage >= 4 || validateFollowUp(record, record.stage, state.screenings).length)
          throw new Error('FOLLOW_UP_INCOMPLETE');
        if (
          record.stage === 1 &&
          followUpTraceFixtures()
            .filter((row) => (record.kind === 'donor' ? row.recipient.id : row.donor.id) === record.detection.person.id)
            .some((row) => !record.traces.some((trace) => trace.id === row.id))
        )
          throw new Error('FOLLOW_UP_TRACING_INCOMPLETE');
        if (
          record.stage === 0 &&
          state.followUps?.some(
            (c) =>
              c.id !== record.id &&
              c.kind === record.kind &&
              c.status === 'open' &&
              c.stage > 0 &&
              c.detection.person.id === record.detection.person.id &&
              c.detection.test === record.detection.test &&
              c.detection.testedOn === record.detection.testedOn,
          )
        )
          throw new Error('FOLLOW_UP_DUPLICATE_CASE');
        record.stage++;
      }
      return commit(state, record);
    },
    async registerSample(input, personId) {
      const state = read();
      const previous = state.followUps?.find((c) => c.id === input.id);
      const existing = previous?.subjects.find((s) => s.person.id === personId);
      if (
        previous?.status !== 'closed' &&
        previous?.kind === input.kind &&
        existing?.sampleId &&
        previous.revision >= input.revision
      )
        return structuredClone(previous);
      const record = prepare(state, input);
      const subject = record.subjects.find((s) => s.person.id === personId);
      if (
        record.stage !== 3 ||
        !subject ||
        !subject.identityVerified ||
        !subject.collectedBy.trim() ||
        !validFollowUpTime(subject.collectedOn)
      )
        throw new Error('FOLLOW_UP_SAMPLE_INCOMPLETE');
      const id = `mock-follow-up-${record.id}-${personId}`;
      const sample = newScreeningSample({
        id,
        collectionId: '',
        unitCode: '',
        sampleCode: `M-${record.id}-${personId}`,
        applicationNumber: '',
        applicantName: subject.person.name,
        documentNumber: subject.person.document,
        sampleType: 'Sangre',
        sampleContainer: 'Tubo',
        origin: {
          type: 'followUp',
          followUpId: record.id,
          subject: record.kind,
        },
      });
      sample.collectedOn = subject.collectedOn;
      sample.collectedBy = subject.collectedBy;
      sample.historyNumber = subject.person.history;
      // The source adapter preserves collector evidence on the case and creates the pending lab sample atomically.
      subject.sampleId = id;
      state.screenings.push(sample);
      return commit(state, record);
    },
    async close(input) {
      const state = read();
      const record = prepare(state, input);
      if (
        record.stage !== 4 ||
        [0, 1, 2, 3, 4].some((stage) => validateFollowUp(record, stage, state.screenings).length)
      )
        throw new Error('FOLLOW_UP_INCOMPLETE');
      record.status = 'closed';
      record.closedAt = new Date().toISOString();
      return commit(state, record);
    },
  };
}
