import { globalScreeningResult } from './screening-rules';
import {
  screeningTableTests,
  type ScreeningRecord,
  type ScreeningRepeatRound,
  type ScreeningRepeatTest,
} from './screening.types';

const testOrder: readonly ScreeningRepeatTest[] = [...screeningTableTests, 'additional'];

export function screeningRepeatTests(round: ScreeningRepeatRound) {
  return testOrder.filter((test) => Object.hasOwn(round.results, test));
}

export function screeningTestLabelKey(test: ScreeningRepeatTest) {
  return test === 'additional' ? 'screeningAdditionalTest' : `screeningTest_${test}`;
}

export function screeningReportCode(record: ScreeningRecord, number = 1) {
  return `${record.sampleCode}-R${String(number).padStart(2, '0')}`;
}

export function screeningReportedTests(record: ScreeningRecord, round?: ScreeningRepeatRound) {
  const tests = round
    ? screeningRepeatTests(round)
    : testOrder.filter((test) => test !== 'additional' || record.additionalTest?.name.trim());
  return tests.map((test) => ({
    test,
    labelKey: screeningTestLabelKey(test),
    name: test === 'additional' ? record.additionalTest?.name : undefined,
    result: round
      ? round.results[test]
      : test === 'additional'
        ? record.additionalTest?.result
        : record.tests[test]?.result,
  }));
}

/** Validated repetitions replace only their corresponding outcomes in the current view. */
export function consolidatedScreening(record: ScreeningRecord, throughRound = Infinity): ScreeningRecord {
  const repeats = (record.repeatRounds ?? []).filter(
    (round) => round.status === 'validated' && round.number <= throughRound,
  );
  const latest = repeats.at(-1);
  if (!latest) return record;
  const tests = { ...record.tests };
  let additionalTest = record.additionalTest;
  for (const round of repeats) {
    for (const test of screeningRepeatTests(round)) {
      const result = round.results[test];
      if (!result) continue;
      if (test === 'additional') {
        if (additionalTest) additionalTest = { ...additionalTest, result };
      } else {
        tests[test] = { ...tests[test], result };
      }
    }
  }
  const current = {
    ...record,
    tests,
    additionalTest,
    performedOn: latest.performedOn,
    performedBy: latest.performedBy,
    validatedAt: latest.validatedAt,
    validatedBy: latest.validatedBy,
  };
  return { ...current, result: globalScreeningResult(current) };
}

export function pendingScreeningRepeatTests(record: ScreeningRecord) {
  if (record.status !== 'validated') return [];
  const current = consolidatedScreening(record);
  const requiresReactiveConfirmation =
    record.origin?.type === 'postExtraction' || (!record.origin && Boolean(record.collectionId && record.unitCode));
  const confirmedRounds = (record.repeatRounds ?? []).filter((round) => round.status === 'validated');
  return screeningReportedTests(current).flatMap(({ test, result }) =>
    result === 'inconclusive' ||
    (result === 'reactive' &&
      (test !== 'additional' || !current.additionalTest?.cmvIgGConceptUuid) &&
      requiresReactiveConfirmation &&
      !confirmedRounds.some((round) => round.results[test] === 'reactive'))
      ? [test]
      : [],
  );
}

export function hasConfirmedReactiveScreening(record: ScreeningRecord) {
  const current = consolidatedScreening(record);
  return (
    record.status === 'validated' &&
    screeningReportedTests(current).some(
      ({ test, result }) =>
        result === 'reactive' &&
        (test !== 'additional' || !current.additionalTest?.cmvIgGConceptUuid) &&
        (record.repeatRounds ?? []).some((round) => round.status === 'validated' && round.results[test] === 'reactive'),
    )
  );
}

export function screeningQueueStatus(record: ScreeningRecord) {
  return pendingScreeningRepeatTests(record).length ? 'screeningRepeatPending' : record.status;
}

/** A draft opens without writing. The API derives the same next round before a save. */
export function screeningRepeatDraft(record: ScreeningRecord): ScreeningRepeatRound | undefined {
  const tests = pendingScreeningRepeatTests(record);
  if (!tests.length) return;
  const previous = record.repeatRounds?.at(-1);
  if (previous && previous.status !== 'validated') return previous;
  const number = (previous?.number ?? 1) + 1;
  return {
    id: `${record.id}-R${number}`,
    number,
    previousReportId: previous?.id ?? record.id,
    revision: 0,
    status: 'draft',
    results: Object.fromEntries(tests.map((test) => [test, ''])),
    performedOn: '',
    performedBy: '',
    validatedAt: null,
    validatedBy: '',
  };
}
