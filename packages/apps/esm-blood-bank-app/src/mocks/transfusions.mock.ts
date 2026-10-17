import { localDateTime } from '../sections/laboratory/screening/screening-rules';
import type { TransfusionRequest } from '../sections/transfusions/transfusions.types';

/** Orders already received; no real patients, provider UUIDs or medical-order writes. */
export function transfusionRequestsMock(): TransfusionRequest[] {
  return [1, 2, 3, 4].map((number) => {
    const code = `TX-DEMO-${String(number).padStart(4, '0')}`;
    const group = number === 2 ? 'A+' : number === 3 ? 'AB+' : 'O+';
    return {
      id: code,
      revision: 1,
      status: 'pending',
      requesterStatus: 'PENDIENTE',
      receivedAt: null,
      sample: null,
      assignments: [],
      rounds: [],
      events: [],
      deliveredAt: null,
      order: {
        id: `ORDER-${code}`,
        number: code,
        patientId: `PATIENT-DEMO-${number}`,
        encounterId: `ENCOUNTER-DEMO-${number}`,
        orderer: 'Médico solicitante DEMO',
        doctorLicense: 'CMP-DEMO',
        requestedAt: new Date(Date.now() - number * 3600000).toISOString(),
        priority: number === 4 ? 'urgent' : 'scheduled',
        patientName: `Receptor sintético ${number}`,
        historyNumber: `HC-TX-DEMO-${number}`,
        document: `9000040${number}`,
        age: '35',
        sex: number % 2 ? 'M' : 'F',
        bloodGroup: group,
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
        items:
          number === 1
            ? [
                { component: 'redCells', quantity: 2 },
                { component: 'freshFrozenPlasma', quantity: 1 },
              ]
            : number === 3
              ? [{ component: 'freshFrozenPlasma', quantity: 1 }]
              : [{ component: 'wholeBlood', quantity: 1 }],
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
      draft: {
        reviewer: '',
        reviewVerified: false,
        consentVerified: false,
        selectedUnitIds: [],
        selectionVerified: false,
        sample: {
          code: `M-REC-${code}`,
          historyNumber: `HC-TX-DEMO-${number}`,
          collectedAt: localDateTime(),
          collectedBy: '',
          identityVerified: false,
        },
        collectorName: '',
        collectorDocument: '',
        deliveredBy: '',
        releaseVerified: false,
      },
    };
  });
}
