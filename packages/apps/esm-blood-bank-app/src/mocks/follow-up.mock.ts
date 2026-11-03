import type {
  FollowUpDetection,
  FollowUpKind,
  FollowUpPerson,
  FollowUpTrace,
} from '../sections/follow-up/follow-up.types';
import { localDateTime } from '../sections/laboratory/screening/screening-rules';

const person = (id: string, name: string): FollowUpPerson => ({
  id,
  name,
  document: `${id.startsWith('D') ? '91000' : '92000'}${id.slice(-3)}`,
  history: `HC-SEG-${id}`,
  age: '35',
  sex: 'female',
  address: 'Domicilio de demostración',
  phone: '000000000',
  mobile: '000000000',
});
export const followUpPeople = {
  d1: person('D001', 'Donante Alfa DEMO'),
  d2: person('D002', 'Donante Beta DEMO'),
  r1: person('R001', 'Receptor Uno DEMO'),
  r2: person('R002', 'Receptor Dos DEMO'),
  r3: person('R003', 'Receptor Tres DEMO'),
};
export function followUpTraceFixtures(): FollowUpTrace[] {
  const date = '2026-10-15';
  return [
    {
      id: 'TR-SEG-001',
      donor: followUpPeople.d1,
      recipient: followUpPeople.r1,
      unit: 'U-SEG-001-PG',
      component: 'Paquete globular',
      seal: 'SC-SEG-001',
      donationDate: date,
      transfusionDate: date,
      previousHere: 'yes',
      previousElsewhere: 'no',
    },
    {
      id: 'TR-SEG-002',
      donor: followUpPeople.d2,
      recipient: followUpPeople.r1,
      unit: 'U-SEG-002-PG',
      component: 'Paquete globular',
      seal: 'SC-SEG-002',
      donationDate: date,
      transfusionDate: date,
      previousHere: 'yes',
      previousElsewhere: 'unknown',
    },
    {
      id: 'TR-SEG-003',
      donor: followUpPeople.d1,
      recipient: followUpPeople.r2,
      unit: 'U-SEG-001-PFC',
      component: 'Plasma fresco congelado',
      seal: 'SC-SEG-003',
      donationDate: date,
      transfusionDate: date,
      previousHere: 'no',
      previousElsewhere: 'yes',
    },
    {
      id: 'TR-SEG-004',
      donor: followUpPeople.d1,
      recipient: followUpPeople.r3,
      unit: 'U-SEG-003-CP',
      component: 'Plaquetas simples',
      seal: 'SC-SEG-004',
      donationDate: date,
      transfusionDate: date,
      previousHere: 'unknown',
      previousElsewhere: 'unknown',
    },
  ];
}
export function followUpCandidates(kind: FollowUpKind): FollowUpDetection[] {
  return (kind === 'donor' ? [followUpPeople.r1] : [followUpPeople.d1]).map((p) => ({
    person: p,
    test: 'anti-HCV',
    testedOn: localDateTime().slice(0, 10),
    reagent: 'Reactivo DEMO',
    brand: 'Marca DEMO',
    lot: 'LOTE-SEG-DEMO',
    confirmed: kind === 'recipient',
    confirmationReference: kind === 'recipient' ? 'CONF-ORIGEN-DEMO' : '',
    reportedBy: 'Profesional DEMO',
    treatingDoctor: 'Médico DEMO',
    notes: '',
  }));
}
