import { donorDetailsMock } from '../mocks/donors.mock';
import { fullName } from '../sections/collection/collection-rules';
import type { DonorDetail, DonorDonation } from '../types/blood-bank.types';
import { readProcessingState, type MockStorage } from './mock-processing-store';

const copy = <T>(value: T): T => structuredClone(value);

export function readMockDonorDetails(getStorage: () => MockStorage): DonorDetail[] {
  const details = copy(donorDetailsMock);
  const records = readProcessingState(getStorage)
    .collections.filter((record) => record.completedSteps.includes('registry'))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const byIdentity = new Map(
    details.map((detail) => [`${detail.documentType}:${detail.summary.documentNumber}`, detail]),
  );
  for (const record of records) {
    const a = record.application;
    const identity = `${a.admission.documentType}:${a.admission.documentNumber}`;
    const previous = byIdentity.get(identity);
    const id = previous?.summary.id || a.admission.donorCode || `DON-${a.number}`;
    const donation: DonorDonation = {
      id: record.id,
      donorId: id,
      documentNumber: a.admission.documentNumber,
      fullName: fullName(a),
      applicationNumber: a.number,
      date: record.registry.date,
      modality: a.admission.modality === 'apheresis' ? 'apheresis' : 'wholeBlood',
      unitCode: record.unitCode,
      bagLot: record.registry.bagLot,
      extractedVolume: record.extractedVolume,
      complications: record.registry.complications,
      extractionStatus: record.registry.extractionStatus,
      attendedBy: record.registry.attendedBy,
    };
    byIdentity.set(identity, {
      documentType: a.admission.documentType,
      patientUuid: a.patientUuid,
      summary: {
        id,
        documentNumber: a.admission.documentNumber,
        fullName: fullName(a),
        bloodGroup: `${a.physical.bloodGroup}${a.physical.rh}`,
        lastDonationDate: record.registry.date,
        status: 'En evaluación',
      },
      personal: copy(a.personal),
      donations: [...(previous?.donations ?? []), donation],
      adverseReactions: previous?.adverseReactions ?? [],
    });
  }
  return [...byIdentity.values()].map((detail) => ({
    ...detail,
    donations: detail.donations.sort((a, b) => b.date.localeCompare(a.date)),
    adverseReactions: detail.adverseReactions.sort((a, b) => b.date.localeCompare(a.date)),
  }));
}
