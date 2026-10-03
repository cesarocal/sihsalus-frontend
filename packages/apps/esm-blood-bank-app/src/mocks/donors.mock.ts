import { newApplication } from '../sections/applicant-selection/selection-rules';
import type { DonorDetail } from '../types/blood-bank.types';
import { donorsMock } from './blood-bank.mock';

/** Fictional demographics and donations, used only by the mock adapter. */
export const donorDetailsMock: DonorDetail[] = donorsMock.map((summary, index) => ({
  summary,
  documentType: 'DNI',
  personal: {
    ...newApplication().personal,
    givenName: index === 0 ? 'Ana' : 'Luis',
    familyName: index === 0 ? 'Torres García' : 'Quispe Ramos',
    sex: index === 0 ? 'F' : 'M',
    birthDate: index === 0 ? '1994-04-12' : '1990-06-03',
    address: `Dirección de prueba ${index + 1}`,
    email: `donante${index + 1}@example.invalid`,
  },
  donations: [
    {
      id: `mock-donation-${index + 1}`,
      donorId: summary.id,
      documentNumber: summary.documentNumber,
      fullName: summary.fullName,
      applicationNumber: `DEMO-${index + 1}`,
      date: summary.lastDonationDate.split('/').reverse().join('-'),
      modality: 'wholeBlood',
      unitCode: `U-DEMO-HIST-${index + 1}`,
      bagLot: `LOTE-DEMO-${index + 1}`,
      extractedVolume: '450',
      complications: 'no',
      extractionStatus: 'complete',
      attendedBy: 'Profesional de prueba',
    },
  ],
  adverseReactions:
    index === 0
      ? [
          {
            id: 'mock-donor-reaction-1',
            date: '2026-08-13',
            unitCode: 'U-DEMO-HIST-1',
            reaction: 'dizziness',
            severity: 'mild',
          },
        ]
      : [],
}));
