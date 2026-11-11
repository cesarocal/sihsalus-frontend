import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApplicantSelectionApi } from './mock-applicant-selection.api';
import { createMockProcessingApi } from './mock-blood-bank-processing.api';
import { createMockInventoryApi } from './mock-inventory.api';
import { processingStorageKey } from './mock-processing-store';
import { localDateTime } from '../sections/laboratory/screening/screening-rules';
import {
  consolidatedScreening,
  screeningQueueStatus,
  screeningRepeatDraft,
} from '../sections/laboratory/screening/screening-repeat-rules';
import { screeningResultsFixture } from '../sections/laboratory/screening/screening-test-fixtures';
import type {
  ScreeningRecord,
  ScreeningRepeatResults,
  ScreeningRepeatRound,
} from '../sections/laboratory/screening/screening.types';

async function initialReport(change: (record: ScreeningRecord) => void) {
  const { screening } = createMockProcessingApi(createMockApplicantSelectionApi());
  const [sample] = await screening.listScreenings();
  const received = await screening.saveScreening(
    { ...sample, receivedBy: 'Recepción de prueba', receivedOn: localDateTime(), identityVerified: true },
    'reception',
  );
  const panel = screeningResultsFixture(received);
  change(panel);
  const completed = await screening.saveScreening(panel, 'results');
  return {
    screening,
    initial: await screening.saveScreening({ ...completed, validatedBy: 'Validador inicial' }, 'validation'),
  };
}

const input = (
  round: ScreeningRepeatRound,
  results: ScreeningRepeatResults,
  operatorName = 'Responsable de repetición',
) => ({
  roundId: round.id,
  revision: round.revision,
  results,
  operatorName,
});

function draft(record: ScreeningRecord) {
  const round = screeningRepeatDraft(record);
  if (!round) throw new Error('TEST_REPEAT_NOT_AVAILABLE');
  return round;
}

describe('screening repetitions', () => {
  beforeEach(() => sessionStorage.clear());

  it('saves partial progress, confirms only the pending tests and preserves the original and each validated round', async () => {
    const { screening, initial } = await initialReport((record) => {
      record.tests.hiv.result = 'inconclusive';
      record.tests.hbsag.result = 'inconclusive';
    });
    const beforeOpen = sessionStorage.getItem(processingStorageKey);
    const first = draft(initial);
    expect(first).toMatchObject({ number: 2, previousReportId: initial.id, results: { hiv: '', hbsag: '' } });
    expect(sessionStorage.getItem(processingStorageKey)).toBe(beforeOpen);
    await expect(
      screening.saveScreeningRepeat(
        initial.id,
        input(first, { hiv: 'nonReactive', hbsag: 'inconclusive', chagas: 'nonReactive' }),
        'results',
      ),
    ).rejects.toThrow('SCREENING_REPEAT_INVALID_TESTS');
    const partial = await screening.saveScreeningRepeat(initial.id, input(first, { hiv: 'nonReactive', hbsag: '' }));
    expect(partial).toMatchObject({ performedOn: '', validatedAt: null, status: 'draft' });
    const [withDraft] = await screening.listScreenings();
    expect(draft(withDraft)).toEqual(partial);
    expect(consolidatedScreening(withDraft).result).toBe('inconclusive');
    const outcomes = { hiv: 'nonReactive', hbsag: 'inconclusive' } as const;
    await expect(screening.saveScreeningRepeat(initial.id, input(first, outcomes), 'results')).rejects.toThrow(
      'SCREENING_REPEAT_CONFLICT',
    );
    await expect(screening.saveScreeningRepeat(initial.id, input(partial, outcomes), 'validation')).rejects.toThrow(
      'SCREENING_REPEAT_NOT_SAVED',
    );
    const ready = await screening.saveScreeningRepeat(initial.id, input(partial, outcomes), 'results');
    expect(ready.performedOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const repeated = await screening.saveScreeningRepeat(
      initial.id,
      input(ready, outcomes, 'Otro validador'),
      'validation',
    );
    expect(repeated).toMatchObject({
      status: 'validated',
      performedBy: 'Responsable de repetición',
      validatedBy: 'Otro validador',
    });
    const [afterFirst] = await screening.listScreenings();
    expect(afterFirst).toMatchObject({
      tests: initial.tests,
      result: initial.result,
      validatedAt: initial.validatedAt,
      validatedBy: initial.validatedBy,
    });
    expect(consolidatedScreening(afterFirst).tests.hiv.result).toBe('nonReactive');
    expect(screeningQueueStatus(afterFirst)).toBe('screeningRepeatPending');
    const next = draft(afterFirst);
    expect(next).toMatchObject({ number: 3, previousReportId: repeated.id, results: { hbsag: '' } });
    const finalReady = await screening.saveScreeningRepeat(
      initial.id,
      input(next, { hbsag: 'nonReactive' }),
      'results',
    );
    const final = await screening.saveScreeningRepeat(
      initial.id,
      input(finalReady, { hbsag: 'nonReactive' }),
      'validation',
    );
    const [complete] = await screening.listScreenings();
    expect(complete.repeatRounds).toEqual([repeated, final]);
    expect(consolidatedScreening(complete, repeated.number).result).toBe('inconclusive');
    expect(consolidatedScreening(complete).result).toBe('nonReactive');
    expect(screeningQueueStatus(complete)).toBe('validated');
    expect(screeningRepeatDraft(complete)).toBeUndefined();
  });

  it('holds the unit in quarantine for an indeterminate additional test without changing the required panel result', async () => {
    const { screening, initial } = await initialReport((record) => {
      record.additionalTest = { name: 'Prueba adicional de ejemplo', result: 'inconclusive' };
    });
    const inventory = createMockInventoryApi();
    const unit = async () => (await inventory.list()).units.find((item) => item.id === initial.unitCode);
    expect(initial.result).toBe('nonReactive');
    expect(await unit()).toMatchObject({ status: 'Cuarentena', screeningResult: 'inconclusive' });
    const ready = await screening.saveScreeningRepeat(
      initial.id,
      input(draft(initial), { additional: 'nonReactive' }),
      'results',
    );
    expect(await unit()).toMatchObject({ status: 'Cuarentena', screeningResult: 'inconclusive' });
    await screening.saveScreeningRepeat(initial.id, input(ready, { additional: 'nonReactive' }), 'validation');
    expect(await unit()).toMatchObject({ status: 'Cuarentena', screeningResult: 'nonReactive' });
  });
});
