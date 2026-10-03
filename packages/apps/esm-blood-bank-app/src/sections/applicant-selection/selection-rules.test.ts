import { describe, expect, it } from 'vitest';
import {
  ageOnDate,
  calculateReturnDate,
  hasActiveExclusion,
  physicalWarnings,
  validateFinal,
  validateStep,
} from './selection-rules';
import { validApplication } from './selection.test-helpers';

describe('selection rules', () => {
  it('calculates completed years and rejects impossible dates', () => {
    expect(ageOnDate('2000-10-03', '2026-10-02')).toBe(25);
    expect(ageOnDate('2000-10-03', '2026-10-03')).toBe(26);
    expect(ageOnDate('2000-02-30', '2026-10-02')).toBeNull();
    expect(ageOnDate('2030-01-01', '2026-10-02')).toBeNull();
  });

  it('calculates calendar deferrals without month or leap-day overflow', () => {
    expect(calculateReturnDate('2026-01-31', '1', 'months')).toBe('2026-02-28');
    expect(calculateReturnDate('2024-02-29', '1', 'years')).toBe('2025-02-28');
    expect(calculateReturnDate('2026-12-31', '1', 'days')).toBe('2027-01-01');
    for (const amount of ['0', '-1', '1.5', '']) expect(calculateReturnDate('2026-01-01', amount, 'days')).toBeNull();
  });

  it('ends temporary exclusion on the return date, not one day later', () => {
    const history = { exclusion: { kind: 'temporary' as const, returnDate: '2026-10-02' } };
    expect(hasActiveExclusion(history, '2026-10-01')).toBe(true);
    expect(hasActiveExclusion(history, '2026-10-02')).toBe(false);
    expect(hasActiveExclusion({ exclusion: { kind: 'permanent', returnDate: null } }, '2099-01-01')).toBe(true);
  });

  it('validates ID, mutually exclusive modality and replacement beneficiary', () => {
    const a = validApplication();
    a.admission.documentNumber = '123';
    a.admission.modality = '';
    a.admission.donationType = 'replacement';
    expect(validateStep(a, 'admission')).toEqual(
      expect.arrayContaining(['validDocumentRequired', 'donationRequired', 'beneficiaryRequired']),
    );
  });

  it('accepts valid vitals and rejects zero, exponents and reversed blood pressure', () => {
    const a = validApplication();
    expect(validateStep(a, 'physical')).toEqual([]);
    a.physical.weight = '0';
    a.physical.pulse = '1e2';
    a.physical.diastolic = '130';
    expect(validateStep(a, 'physical')).toEqual(expect.arrayContaining(['vitalsRequired', 'pressureOrder']));
  });

  it('flags pressure and oral temperature without automatically deciding eligibility', () => {
    const a = validApplication();
    expect(physicalWarnings(a)).toEqual([]);
    a.physical.systolic = '181';
    a.physical.temperature = '38';
    expect(physicalWarnings(a)).toEqual(expect.arrayContaining(['systolicWarning', 'temperatureWarning']));
    expect(a.qualification.result).toBe('eligible');
    a.physical.warningAcknowledgement = 'Revisión de prueba';
    expect(validateStep(a, 'qualification')).toContain('blockingPressure');
  });

  it('requires affirmative follow-ups and hides their requirement when the answer changes', () => {
    const a = validApplication();
    a.interview.answers.medication = 'yes';
    expect(validateStep(a, 'interview')).toContain('answerDetails');
    a.interview.details.medicationWhich = 'Respuesta sintética';
    expect(validateStep(a, 'interview')).toEqual([]);
    a.interview.answers.medication = 'no';
    delete a.interview.details.medicationWhich;
    expect(validateStep(a, 'interview')).toEqual([]);
  });

  it('requires all STI branches and the other-type description', () => {
    const a = validApplication();
    a.interview.answers.sti = 'yes';
    expect(validateStep(a, 'interview')).toContain('answerSti');
    Object.assign(a.interview.answers, { syphilis: 'no', gonorrhea: 'no', chancroid: 'no', otherSti: 'yes' });
    expect(validateStep(a, 'interview')).toContain('answerDetails');
    a.interview.details.otherSti = 'Detalle sintético';
    expect(validateStep(a, 'interview')).toEqual([]);
  });

  it('requires the female-only answers and rejects future dates', () => {
    const a = validApplication();
    a.personal.sex = 'F';
    expect(validateStep(a, 'interview')).toContain('womenRequired');
    Object.assign(a.interview, { pregnant: 'no', breastfeeding: 'no', pregnancies: '0' });
    expect(validateStep(a, 'interview')).toEqual([]);
    a.interview.lastPeriod = '2099-01-01';
    expect(validateStep(a, 'interview')).toContain('validDateRequired');
  });

  it('requires exclusion reason and duration, but not a skipped interview when stopped', () => {
    const a = validApplication();
    a.stoppedAfterPhysical = true;
    a.interview.answers = {};
    Object.assign(a.qualification, {
      result: 'temporary',
      duration: '1',
      durationUnit: 'months',
      reason: 'Motivo sintético',
    });
    expect(validateFinal(a)).toEqual([]);
    a.qualification.reason = '';
    expect(validateFinal(a)).toContain('reasonRequired');
    a.qualification.result = 'eligible';
    expect(validateFinal(a)).toContain('stoppedNotEligible');
  });

  it('requires clinical validation and acknowledgement for eligible exceptions', () => {
    const a = validApplication();
    a.physical.pulse = '49';
    a.qualification.validatedBy = '';
    expect(validateStep(a, 'qualification')).toEqual(
      expect.arrayContaining(['validatorRequired', 'clinicalReviewRequired']),
    );
  });
});
