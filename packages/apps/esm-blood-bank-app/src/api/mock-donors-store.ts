import { donorDetailsMock } from '../mocks/donors.mock';
import { normalizePersonalTrips } from '../sections/applicant-selection/selection-rules';
import { collectionReactionIdentity, fullName } from '../sections/collection/collection-rules';
import type { DonorDetail, DonorDonation } from '../types/blood-bank.types';
import { readProcessingState, type MockStorage } from './mock-processing-store';

const copy = <T>(value: T): T => structuredClone(value);

export function readMockDonorDetails(getStorage: () => MockStorage): DonorDetail[] {
  const details = copy(donorDetailsMock);
  const records = readProcessingState(getStorage)
    .collections.filter((record) => record.completedSteps.includes('registry') || record.donorReactions?.length)
    .sort((a, b) => a.registry.date.localeCompare(b.registry.date) || a.updatedAt.localeCompare(b.updatedAt));
  const byIdentity = new Map(
    details.map((detail) => [`${detail.documentType}:${detail.summary.documentNumber}`, detail]),
  );
  for (const record of records) {
    const a = record.application;
    const identity = `${a.admission.documentType}:${a.admission.documentNumber}`;
    const previous = byIdentity.get(identity);
    const id = previous?.summary.id || a.admission.donorCode || `DON-${a.number}`;
    const reactionIdentity = collectionReactionIdentity(record);
    const reactions = record.donorReactions ?? [];
    const hasRegistry = record.completedSteps.includes('registry');
    const donation: DonorDonation = {
      id: record.id,
      donorId: id,
      documentNumber: a.admission.documentNumber,
      fullName: fullName(a),
      applicationNumber: a.number,
      date: record.registry.date,
      modality: a.admission.modality === 'apheresis' ? 'apheresis' : 'wholeBlood',
      unitCode: record.interruptedWithoutUnit ? '' : record.unitCode,
      bagLot: record.registry.bagLot,
      extractedVolume: record.extractedVolume,
      complications: record.registry.complications,
      extractionStatus: record.registry.extractionStatus,
      attendedBy: record.registry.attendedBy,
      reactionView: reactions.length ? { identity: reactionIdentity, reports: reactions } : undefined,
    };
    byIdentity.set(identity, {
      documentType: a.admission.documentType,
      patientUuid: a.patientUuid,
      summary: {
        id,
        documentNumber: a.admission.documentNumber,
        fullName: fullName(a),
        bloodGroup: `${a.physical.bloodGroup}${a.physical.rh}`,
        lastDonationDate:
          hasRegistry && !record.interruptedWithoutUnit
            ? record.registry.date
            : (previous?.summary.lastDonationDate ?? ''),
        status: 'En evaluación',
      },
      personal: normalizePersonalTrips(copy(a.personal)),
      donations: hasRegistry ? [...(previous?.donations ?? []), donation] : (previous?.donations ?? []),
      adverseReactions: [
        ...(previous?.adverseReactions ?? []),
        ...reactions.map((reaction) => ({
          id: reaction.id,
          date: reaction.occurredAt,
          unitCode: reactionIdentity.unitCode,
          reaction: reaction.type,
          severity: reaction.assessment?.severity,
          reactionView: { identity: reactionIdentity, reports: [reaction] },
        })),
      ],
    });
  }
  return [...byIdentity.values()].map((detail) => ({
    ...detail,
    donations: detail.donations.sort((a, b) => b.date.localeCompare(a.date)),
    adverseReactions: detail.adverseReactions.sort((a, b) => b.date.localeCompare(a.date)),
  }));
}
