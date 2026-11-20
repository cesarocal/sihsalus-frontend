import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
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
  sections: Partial<Record<Stage, SavedSection>>;
}
export const vitalKeys = [
  'pressure',
  'pulse',
  'respirations',
  'temperature',
  'pallor',
  'cyanosis',
  'bleeding',
  'bloodLoss',
];
export const reactionVitalKeys = ['temperature', 'pressure', 'pulse', 'respirations'];
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
  'hemoglobinuria',
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

export function currentStage(unit: UnitCase) {
  if (unit.sections.investigation) return 'investigated';
  if (unit.sections.review) return 'reviewed';
  if (unit.sections.report) return 'reported';
  return 'notReported';
}

export function reportDefaults(conduction: Fields = {}): Fields {
  return {
    startTime: conduction.startTime ?? '',
    transfused: conduction.transfused ?? '',
    otherSymptomText: conduction.otherSymptomText ?? '',
    ...Object.fromEntries(reactionSigns.map((key) => [key, conduction[key] ?? ''])),
  };
}

export function validStage(stage: Stage, fields: Fields, saved: UnitCase['sections']) {
  if (stage === 'conduction') return Boolean(fields.conductionDate && fields.startTime);
  if (stage === 'report')
    return (
      !saved.report &&
      Boolean(
        fields.startTime &&
          fields.stopTime &&
          fields.transfused &&
          Number.isFinite(Number(fields.transfused)) &&
          Number(fields.transfused) >= 0 &&
          (reactionSigns.some((key) => fields[key] === 'yes') ||
            reactionVitalKeys.some(
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
