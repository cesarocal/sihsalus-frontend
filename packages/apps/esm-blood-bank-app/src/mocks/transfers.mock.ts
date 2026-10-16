import type { TransferRequest } from '../sections/transfers/transfers.types';
import { newTransferRequest } from '../sections/transfers/transfers-rules';

/** Incoming examples only. No institution, receiver or patient is a real identity. */
export function transferRequestsMock(): TransferRequest[] {
  return [1, 2, 3].map((number) => {
    const request = newTransferRequest();
    const now = new Date().toISOString();
    return {
      ...request,
      id: `TR-DEMO-${String(number).padStart(5, '0')}`,
      revision: 1,
      status: 'received',
      createdAt: now,
      updatedAt: now,
      data: {
        ...request.data,
        office: `OFICIO-DEMO-${number}`,
        requestingInstitution: `Establecimiento solicitante DEMO ${number}`,
        destinationInstitution: 'Centro de hemoterapia DEMO',
        requestingDirector: 'Dirección solicitante DEMO',
        addressedDirector: 'Dirección destinataria DEMO',
        attention: 'Responsable de Banco de Sangre DEMO',
        patientName: `Receptor sintético ${number}`,
        patientAge: '35',
        patientDocument: `9000030${number}`,
        patientHistory: `HC-EXTERNA-DEMO-${number}`,
        patientBloodGroup: number === 3 ? 'AB-' : 'O+',
        ward: 'Servicio DEMO',
        bed: `${number}`,
        diagnosis: 'Diagnóstico sintético para demostración',
        transfusionReason: 'Indicación registrada en solicitud DEMO',
        transferReason: 'Falta de stock en establecimiento DEMO',
        items: [
          {
            id: `item-${number}`,
            component: 'wholeBlood',
            quantity: number === 1 ? 2 : 1,
            bloodGroup: number === 3 ? 'AB-' : 'O+',
          },
        ],
      },
    };
  });
}
