import type { TransfusionOrder, TransfusionRequest } from '../sections/transfusions/transfusions.types';
import { initialTransfusionRequest } from '../sections/transfusions/transfusions-rules';

const scenarios: Array<Pick<TransfusionOrder, 'bloodGroup' | 'priority' | 'items'>> = [
  {
    bloodGroup: 'O+',
    priority: 'scheduled',
    items: [
      { component: 'redCells', quantity: 2 },
      { component: 'freshFrozenPlasma', quantity: 1 },
    ],
  },
  { bloodGroup: 'A+', priority: 'scheduled', items: [{ component: 'wholeBlood', quantity: 1 }] },
  { bloodGroup: 'AB+', priority: 'scheduled', items: [{ component: 'freshFrozenPlasma', quantity: 1 }] },
  { bloodGroup: 'O+', priority: 'urgent', items: [{ component: 'wholeBlood', quantity: 1 }] },
  { bloodGroup: 'A+', priority: 'scheduled', items: [{ component: 'redCells', quantity: 1 }] },
  { bloodGroup: 'A+', priority: 'scheduled', items: [{ component: 'freshFrozenPlasma', quantity: 1 }] },
  { bloodGroup: 'O-', priority: 'scheduled', items: [{ component: 'redCells', quantity: 2 }] },
  { bloodGroup: 'A+', priority: 'urgent', items: [{ component: 'redCells', quantity: 1 }] },
  {
    bloodGroup: 'A+',
    priority: 'veryUrgent',
    items: [
      { component: 'redCells', quantity: 2 },
      { component: 'freshFrozenPlasma', quantity: 1 },
    ],
  },
  { bloodGroup: 'O-', priority: 'veryUrgent', items: [{ component: 'redCells', quantity: 2 }] },
];

/** Orders already received; no real patients, provider UUIDs or medical-order writes. */
export function transfusionRequestsMock(): TransfusionRequest[] {
  return scenarios.map((scenario, index) => {
    const number = index + 1;
    const code = `TX-DEMO-${String(number).padStart(4, '0')}`;
    return initialTransfusionRequest(
      {
        ...structuredClone(scenario),
        id: `ORDER-${code}`,
        number: code,
        patientId: `PATIENT-DEMO-${number}`,
        encounterId: `ENCOUNTER-DEMO-${number}`,
        orderer: 'Médico solicitante DEMO',
        doctorLicense: 'CMP-DEMO',
        requestedAt: new Date(Date.now() - number * 3600000).toISOString(),
        patientName: `Receptor sintético ${number}`,
        historyNumber: `HC-TX-DEMO-${number}`,
        document: String(90000400 + number),
        age: '35',
        sex: number % 2 ? 'M' : 'F',
        service: 'Servicio DEMO',
        ward: 'Sala DEMO',
        bed: `${number}`,
        diagnosis: 'Diagnóstico sintético para demostración',
        hemoglobin: '8',
        hematocrit: '24',
        platelets: '150000',
        priorTransfusions: number === 1 ? 'yes' : 'unknown',
        priorReactions: 'unknown',
        pregnancies: number === 2 ? '0' : '',
        abortions: '',
        maternalIncompatibility: '',
        history:
          number === 1
            ? [
                {
                  id: 'TX-PAST-DEMO',
                  date: '2026-01-15',
                  component: 'redCells',
                  unit: 'UNIDAD-PASADA-DEMO',
                  reaction: 'Sin reacción registrada (DEMO)',
                },
              ]
            : [],
      },
      code,
    );
  });
}
