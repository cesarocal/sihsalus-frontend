import { interviewQuestions, physicalFields, stiQuestions } from './selection-fields';
import type { ApplicantHistory, SelectionApplication, SelectionStep } from './selection.types';

export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function ageOnDate(birthDate: string, date: string): number | null {
  if (!isDate(birthDate) || !isDate(date) || birthDate > date) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  const [currentYear, currentMonth, currentDay] = date.split('-').map(Number);
  return currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
}

export function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` ===
      value
  );
}

export function calculateReturnDate(date: string, amount: string, unit: 'days' | 'months' | 'years'): string | null {
  if (!isDate(date) || !/^\d+$/.test(amount) || Number(amount) < 1 || Number(amount) > 36500) return null;
  const result = new Date(`${date}T12:00:00`);
  const day = result.getDate();
  if (unit === 'days') result.setDate(day + Number(amount));
  else {
    result.setDate(1);
    if (unit === 'months') result.setMonth(result.getMonth() + Number(amount));
    else result.setFullYear(result.getFullYear() + Number(amount));
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, lastDay));
  }
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}

export function hasActiveExclusion(history: ApplicantHistory | null, date: string) {
  return Boolean(
    history?.exclusion &&
      (history.exclusion.kind === 'permanent' || !history.exclusion.returnDate || history.exclusion.returnDate > date),
  );
}

export function newApplication(): SelectionApplication {
  return {
    id: '',
    number: '',
    revision: 0,
    status: 'draft',
    completedSteps: [],
    stoppedAfterPhysical: false,
    admission: {
      date: today(),
      documentType: 'DNI',
      documentNumber: '',
      donorCode: '',
      donationType: '',
      modality: '',
      beneficiaryName: '',
      beneficiaryDocument: '',
    },
    personal: {
      givenName: '',
      familyName: '',
      sex: '',
      birthDate: '',
      birthPlace: '',
      maritalStatus: '',
      provenance: '',
      address: '',
      district: '',
      province: '',
      department: '',
      occupation: '',
      phone: '',
      mobile: '',
      email: '',
      workplace: '',
      travelPlace: '',
      travelDuration: '',
      travelDate: '',
    },
    physical: {
      weight: '',
      height: '',
      systolic: '',
      diastolic: '',
      pulse: '',
      temperature: '',
      bloodGroup: '',
      rh: '',
      hemoglobin: '',
      hematocrit: '',
      armInspection: '',
      observations: '',
      warningAcknowledgement: '',
    },
    interview: {
      answers: {},
      details: {},
      lastPeriod: '',
      pregnant: '',
      breastfeeding: '',
      lastDelivery: '',
      pregnancies: '',
      observations: '',
    },
    qualification: {
      result: '',
      duration: '',
      durationUnit: 'days',
      reason: '',
      applicantName: '',
      interviewerName: '',
      interviewerLicense: '',
      validatedBy: '',
      observations: '',
    },
    returnDate: null,
    updatedAt: '',
  };
}

export function isFinal(application: SelectionApplication) {
  return ['selected', 'deferred', 'excluded'].includes(application.status);
}

/** Advisory review flags from RM 241-2018, section 6.2. Never an automatic eligibility decision. */
export function physicalWarnings(application: SelectionApplication): string[] {
  const p = application.physical;
  const warnings: string[] = [];
  if (Number(p.weight) < 50) warnings.push('weightWarning');
  if (Number(p.systolic) < 100 || Number(p.systolic) > 140) warnings.push('systolicWarning');
  if (Number(p.diastolic) < 60 || Number(p.diastolic) > 90) warnings.push('diastolicWarning');
  if (Number(p.pulse) < 50 || Number(p.pulse) > 100) warnings.push('pulseWarning');
  if (Number(p.temperature) > 37.5) warnings.push('temperatureWarning');
  const male = application.personal.sex === 'M';
  if (p.hemoglobin && Number(p.hemoglobin) < (male ? 13.5 : 12.5)) warnings.push('hemoglobinWarning');
  if (p.hematocrit && Number(p.hematocrit) < (male ? 40 : 38)) warnings.push('hematocritWarning');
  if (p.armInspection === 'lesions') warnings.push('armsWarning');
  if ((ageOnDate(application.personal.birthDate, application.admission.date) ?? 0) < 18) warnings.push('ageWarning');
  if (application.admission.modality === 'apheresis') warnings.push('apheresisWarning');
  if (application.admission.donationType === 'autologous') warnings.push('autologousWarning');
  return warnings;
}

export function validateStep(application: SelectionApplication, step: SelectionStep): string[] {
  const a = application;
  const errors: string[] = [];
  if (step === 'admission') {
    if (!isDate(a.admission.date) || a.admission.date > today()) errors.push('validDateRequired');
    const document = a.admission.documentNumber.trim();
    if (
      !document ||
      (a.admission.documentType === 'DNI' ? !/^\d{8}$/.test(document) : !/^[\p{L}\p{N}-]{4,20}$/u.test(document))
    )
      errors.push('validDocumentRequired');
    if (!a.admission.donationType || !a.admission.modality) errors.push('donationRequired');
    if (
      a.admission.donationType === 'replacement' &&
      (!a.admission.beneficiaryName.trim() || !a.admission.beneficiaryDocument.trim())
    )
      errors.push('beneficiaryRequired');
  }
  if (step === 'personal') {
    if (
      !a.personal.givenName.trim() ||
      !a.personal.familyName.trim() ||
      !a.personal.sex ||
      ageOnDate(a.personal.birthDate, a.admission.date) === null
    )
      errors.push('identityRequired');
    if (
      !a.personal.address.trim() ||
      !a.personal.district.trim() ||
      !a.personal.province.trim() ||
      !a.personal.department.trim()
    )
      errors.push('addressRequired');
    if (a.personal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.personal.email)) errors.push('validEmailRequired');
    if (a.personal.travelDate && (!isDate(a.personal.travelDate) || a.personal.travelDate > a.admission.date))
      errors.push('validDateRequired');
  }
  if (step === 'physical') {
    if (
      physicalFields.some(
        ({ key, required }) =>
          (required || a.physical[key]) && (!/^\d+(\.\d+)?$/.test(a.physical[key]) || Number(a.physical[key]) <= 0),
      )
    )
      errors.push('vitalsRequired');
    if (Number(a.physical.diastolic) >= Number(a.physical.systolic)) errors.push('pressureOrder');
    if (!a.physical.armInspection) errors.push('armsRequired');
    if (!a.physical.hemoglobin && !a.physical.hematocrit) errors.push('hbRequired');
  }
  if (step === 'interview') {
    if (interviewQuestions.some((q) => !a.interview.answers[q.id])) errors.push('answerAllQuestions');
    if (
      interviewQuestions.some(
        (q) => q.detail && a.interview.answers[q.id] === 'yes' && !a.interview.details[q.detail]?.trim(),
      )
    )
      errors.push('answerDetails');
    if (a.interview.answers.sti === 'yes' && stiQuestions.some((id) => !a.interview.answers[id]))
      errors.push('answerSti');
    if (
      a.interview.answers.sti === 'yes' &&
      a.interview.answers.otherSti === 'yes' &&
      !a.interview.details.otherSti?.trim()
    )
      errors.push('answerDetails');
    if (
      a.personal.sex === 'F' &&
      (!a.interview.pregnant || !a.interview.breastfeeding || !/^\d+$/.test(a.interview.pregnancies))
    )
      errors.push('womenRequired');
    if (
      [a.interview.lastPeriod, a.interview.lastDelivery].some(
        (date) => date && (!isDate(date) || date > a.admission.date || date < a.personal.birthDate),
      )
    )
      errors.push('validDateRequired');
  }
  if (step === 'qualification') {
    const q = a.qualification;
    if (!q.result || !q.applicantName.trim() || !q.interviewerName.trim() || !q.interviewerLicense.trim())
      errors.push('qualificationRequired');
    if (q.result !== 'eligible' && !q.reason.trim()) errors.push('reasonRequired');
    if (q.result === 'temporary' && !calculateReturnDate(a.admission.date, q.duration, q.durationUnit))
      errors.push('durationRequired');
    if (q.result === 'eligible' && !q.validatedBy.trim()) errors.push('validatorRequired');
    if (q.result === 'eligible' && a.stoppedAfterPhysical) errors.push('stoppedNotEligible');
    if (q.result === 'eligible' && Number(a.physical.systolic) >= 180) errors.push('blockingPressure');
    if (q.result === 'eligible' && physicalWarnings(a).length && !a.physical.warningAcknowledgement.trim())
      errors.push('clinicalReviewRequired');
  }
  return errors;
}

export function validateFinal(application: SelectionApplication): string[] {
  const steps: SelectionStep[] = ['admission', 'personal', 'physical', 'qualification'];
  if (!application.stoppedAfterPhysical) steps.push('interview');
  return [...new Set(steps.flatMap((step) => validateStep(application, step)))];
}
