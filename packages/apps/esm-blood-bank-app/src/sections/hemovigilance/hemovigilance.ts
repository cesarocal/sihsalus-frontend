import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { TransfusionOrder } from '../transfusions/transfusions.types';

export const hemoPrivileges = {
  chart: 'app:hoja.clinica.transfusiones',
  conduction: 'app:hoja.clinica.transfusiones.conduccion.editar',
  report: 'app:hoja.clinica.transfusiones.reacciones.registrar',
  review: 'app:hoja.clinica.transfusiones.reacciones.revisar',
  bank: 'app:home.bancoSangre.transfusiones.reacciones.investigar',
};

export const demoMetadata = {
  encounters: {
    dispatch: '29ccb51c-d420-46c5-b346-4961970ee4bd',
    conduction: '3be18166-2d47-4d5e-8e5e-352b052384ca',
    report: '2afaf770-502f-4994-bdfb-f676891ada35',
    review: '156c6782-7eaf-4df8-804d-12dabb0ec49f',
    investigation: 'f653218a-0159-41cb-bf18-13f52fe81053',
  },
  text: '60f2f10b-e54a-4b68-8ea6-45a66570f2bb',
  testPatient: 'a968f17f-9426-4ecb-a107-ab7d91aaa880',
};

export interface Actor {
  name: string;
  personUuid: string;
  license: string;
}
export interface Dispatch {
  unitCode: string;
  lot: string;
  component: ComponentType;
  bloodGroup: string;
  seal: string;
  deliveredAt: string;
}

export type Fields = Record<string, string>;
export type Stage = 'conduction' | 'report' | 'review' | 'investigation';
export interface SavedSection {
  fields: Fields;
  actor: Actor;
  at: string;
  uuid: string;
}
export interface UnitCase {
  order: TransfusionOrder;
  dispatch: Dispatch;
  deliveryLocation?: string;
  sections: Partial<Record<Stage, SavedSection>>;
}
export const vitalKeys = [
  'systolicPressure',
  'diastolicPressure',
  'pulse',
  'respirations',
  'temperature',
  'pallor',
  'cyanosis',
  'bleeding',
  'bloodLoss',
];
export const reactionVitalKeys = ['temperature', 'pressure', 'pulse', 'respirations'] as const;
export const reactionPressureKeys = ['systolic', 'diastolic'] as const;
const reactionVitalUnits = { temperature: '', pressure: 'mmHg', pulse: 'ppm', respirations: 'rpm' } as const;

export function reactionVitalLabel(key: (typeof reactionVitalKeys)[number], t: ProcessingTranslate) {
  const unit = reactionVitalUnits[key];
  return unit ? `${t(key)} (${unit})` : t(key);
}
export const antecedentKeys = [
  'ivDrugs',
  'drugAllergy',
  'dialysis',
  'lues',
  'otherAllergies',
  'lymphogranuloma',
  'hepatitis',
  'asthma',
  'sexualRisk',
  'alcohol',
  'gonorrhea',
  'otherHistory',
];
export const conductionSigns = [
  'sternalPain',
  'fever',
  'hives',
  'otherSymptom',
  'hemoglobinemia',
  'chills',
  'cough',
  'diffuseBleeding',
  'hypotension',
  'dyspnea',
];
export const reactionSigns = [
  'chills',
  'cyanosis',
  'headache',
  'nausea',
  'thoracicPain',
  'itching',
  'facialEdema',
  'lumbarPain',
  'hemoglobinuria',
  'otherSymptom',
];
export const conditions = ['sepsis', 'dic', 'chemotherapy', 'antibiotics', 'methyldopa'];
export const studies = ['bilirubin', 'urinalysis', 'coagulation', 'otherStudy'];
export const findings = [
  'acuteHemolysis',
  'delayedHemolysis',
  'nonImmuneHemolysis',
  'fever',
  'circulatoryOverload',
  'postTransfusionHepatitis',
  'transmissibleDisease',
  'anaphylaxis',
  'bacterialContamination',
  'allergy',
  'otherFinding',
];
export const reportTimes = ['startTime', 'stopTime', 'doctorNotified', 'bankNotified', 'urineTime'];
export const transfusionStates = ['transfusionInProgress', 'transfusionCompleted', 'transfusionInterrupted'] as const;
export const reactionStates = ['notReported', 'reported', 'reviewed', 'investigated'] as const;

export const maxMonitoringColumns = 6;
const monitoringColumnIndexes = Array.from({ length: maxMonitoringColumns }, (_, index) => index);
export const priorTransfusionKeys = ['date', 'unitCode', 'component', 'priorReaction', 'place', 'notes'] as const;
export const operatingRoomOptions = {
  consciousness: ['alert', 'drowsyOrDisoriented', 'coma'],
  cardiovascular: ['normal', 'cardiovascularCondition'],
  pulmonary: ['normal', 'pulmonaryDisease'],
} as const;

export function conductionCode(unit: UnitCase) {
  return `HC-${unit.order.number}-${unit.dispatch.unitCode}`;
}

export function conductionFields(unit: UnitCase): Fields {
  const saved = unit.sections.conduction?.fields;
  const physician = saved?.responsiblePhysician || unit.order.orderer;
  return {
    ...saved,
    conductionDate: saved?.conductionDate || localDateTime().slice(0, 10),
    responsiblePhysician: physician,
    physicianRegistration:
      saved?.physicianRegistration || (physician === unit.order.orderer ? unit.order.doctorLicense : ''),
  };
}

export function conductionSignKeys(fields: Fields) {
  return fields.hemoglobinuria === 'yes' ? [...conductionSigns, 'hemoglobinuria'] : conductionSigns;
}

export function manualHistoryRows(fields: Fields) {
  const rows = new Set<number>();
  for (const key of Object.keys(fields)) {
    const match = /^history(\d+)[a-zA-Z]+$/.exec(key);
    if (match) rows.add(Number(match[1]));
  }
  return [...rows].sort((a, b) => a - b);
}

export function conductionVitalKeys(fields: Fields) {
  return monitoringColumnIndexes.some((index) => fields[`pressure${index}`]) ? ['pressure', ...vitalKeys] : vitalKeys;
}

export function monitoringColumns(fields: Fields) {
  const count = Number(fields.monitoringColumns);
  const savedCount = Number.isInteger(count) && count <= maxMonitoringColumns ? count : 0;
  const observedKeys = ['time', ...conductionVitalKeys(fields)];
  const columns = monitoringColumnIndexes;
  const lastUsed = columns.reduce((last, index) => (observedKeys.some((key) => fields[key + index]) ? index : last), 0);
  return columns.slice(0, Math.max(savedCount, lastUsed + 1));
}

export function conductionError(fields: Fields) {
  if (!fields.conductionDate || !fields.startTime) return 'invalidconduction';
  let previous = '';
  for (const column of monitoringColumns(fields)) {
    const time = fields[`time${column}`];
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? '')) return 'monitoringTimeRequired';
    if (time < previous) return 'monitoringTimeOrder';
    previous = time;
  }
  return '';
}

export function previousConductions(unit: UnitCase, fields: Fields, cases: UnitCase[]) {
  const startedAt = (entry: Fields) =>
    entry.conductionDate && entry.startTime ? Date.parse(`${entry.conductionDate}T${entry.startTime}`) : NaN;
  const cutoff = startedAt(fields) || Date.now();
  return cases
    .map((entry) => ({ entry, at: startedAt(entry.sections.conduction?.fields ?? {}) }))
    .filter(
      ({ entry, at }) =>
        entry.order.patientId === unit.order.patientId &&
        (entry.order.id !== unit.order.id || entry.dispatch.unitCode !== unit.dispatch.unitCode) &&
        at < cutoff,
    )
    .sort((a, b) => b.at - a.at)
    .map(({ entry }) => entry);
}

export function priorConductionValues(unit: UnitCase, t: ProcessingTranslate) {
  const fields = unit.sections.conduction?.fields ?? {};
  return {
    date: fields.conductionDate ?? '',
    unitCode: unit.dispatch.unitCode,
    component: t(componentDefinitions[unit.dispatch.component].key),
    priorReaction: conductionSignKeys(fields)
      .filter((key) => fields[key] === 'yes')
      .map((key) =>
        key === 'otherSymptom' && fields.otherSymptomText ? `${t(key)} (${fields.otherSymptomText})` : t(key),
      )
      .join(', '),
    place: unit.deliveryLocation ?? '',
    notes: '',
  };
}

export function currentStage(unit: UnitCase) {
  if (unit.sections.investigation) return 'investigated';
  if (unit.sections.review) return 'reviewed';
  if (unit.sections.report) return 'reported';
  return 'notReported';
}

export function transfusionProgress(unit: UnitCase) {
  const { conduction, report } = unit.sections;
  if (conduction?.fields.stopTime || conduction?.fields.consentInterruptionUuid || report?.fields.stopTime)
    return 'transfusionInterrupted';
  if (!conduction?.fields.startTime) return undefined;
  return conduction.fields.endTime ? 'transfusionCompleted' : 'transfusionInProgress';
}

export function canReportReaction(conduction?: Fields) {
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  return validTime.test(conduction?.startTime ?? '') && validTime.test(conduction?.endTime ?? '');
}

export function reportNotificationTimes({ report, review }: UnitCase['sections']) {
  const time = (record?: SavedSection) => {
    const date = record && new Date(record.at);
    return date && Number.isFinite(date.getTime()) ? localDateTime(date).slice(11, 16) : '';
  };
  return {
    doctorNotified: report?.fields.doctorNotified || time(report),
    bankNotified: time(review),
  };
}

export function reportDefaults(conduction: Fields = {}): Fields {
  return {
    startTime: conduction.startTime ?? '',
    stopTime: conduction.endTime ?? '',
    bed: '',
    transfused: conduction.transfused ?? '',
    otherSymptomText: conduction.otherSymptomText ?? '',
    ...Object.fromEntries(reactionSigns.map((key) => [key, conduction[key] ?? ''])),
  };
}

const premedicationPrefix = 'premedication:';

export function premedicationField(uuid: string) {
  return premedicationPrefix + uuid;
}

export function reportPremedications(fields: Fields) {
  const selections = Object.entries(fields)
    .filter(([key, name]) => key.startsWith(premedicationPrefix) && name)
    .map(([key, name]) => ({ uuid: key.slice(premedicationPrefix.length), name }));
  if (!selections.length && fields.premedication) {
    selections.push({ uuid: fields.premedicationConceptUuid ?? '', name: fields.premedication });
  }
  return selections;
}

export function validStage(stage: Stage, fields: Fields, saved: UnitCase['sections']) {
  if (stage === 'conduction') return !saved.conduction?.fields.endTime && !conductionError(fields);
  if (stage === 'report')
    return (
      !saved.report &&
      canReportReaction(saved.conduction?.fields) &&
      fields.startTime === saved.conduction?.fields.startTime &&
      fields.stopTime === saved.conduction?.fields.endTime &&
      Boolean(
        fields.transfused &&
          Number.isFinite(Number(fields.transfused)) &&
          Number(fields.transfused) >= 0 &&
          (reactionSigns.some((key) => fields[key] === 'yes') ||
            [...reactionVitalKeys, ...reactionPressureKeys].some(
              (key) =>
                fields[key + 'Before'] && fields[key + 'After'] && fields[key + 'Before'] !== fields[key + 'After'],
            )),
      ) &&
      (fields.otherSymptom !== 'yes' || Boolean(fields.otherSymptomText?.trim()))
    );
  if (stage === 'review') return Boolean(saved.report && !saved.review);
  return (
    Boolean(saved.report && !saved.investigation && fields.recommendations?.trim()) &&
    (fields.otherStudy !== 'yes' || Boolean(fields.otherStudyText?.trim())) &&
    (fields.otherFinding !== 'yes' || Boolean(fields.otherFindingText?.trim()))
  );
}
