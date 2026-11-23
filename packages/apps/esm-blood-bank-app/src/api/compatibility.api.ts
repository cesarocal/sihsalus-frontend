import { openmrsFetch } from '@openmrs/esm-framework';

import type { ComponentType } from '../sections/laboratory/fractionation/fractionation.types';
import { readLinkedFr08 } from '../sections/transfusions/transfusion-order.resource';
import {
  type CompatibilityRound,
  type RecipientSample,
  type TransfusionAssignment,
  type TransfusionOrder,
  type TransfusionRequest,
} from '../sections/transfusions/transfusions.types';

const base = '/ws/rest/v1/bloodbank';
const roundUrl = (requestId: string, roundId: string) =>
  `${base}/transfusion-requests/${encodeURIComponent(requestId)}/compatibility/${encodeURIComponent(roundId)}`;

interface StoredTest {
  unitCode: string;
  unitSampleCode: string;
  componentConceptUuid: string;
  componentDisplay?: string;
  groupConceptUuid?: string;
  rhConceptUuid?: string;
  result: TransfusionAssignment['result'];
  resultAt: string | null;
  testedBy: string;
  sealCode?: string;
}

interface StoredRound {
  id: string;
  requestId: string;
  patientUuid: string;
  revision: number;
  writable: boolean;
  communicable: boolean;
  createdAt: string;
  completedAt: string | null;
  labelsPrintRequestedAt?: string | null;
  identityVerified: boolean;
  pretransfusionVerified: boolean;
  operator: string;
  communicated?: { at: string; by: string } | null;
  sample: Pick<RecipientSample, 'code' | 'collectedAt' | 'collectedBy'>;
  tests: StoredTest[];
  results: CompatibilityRound['results'];
  deliveredAt: string | null;
}

export interface PersistedCompatibilityApi {
  list(): Promise<TransfusionRequest[]>;
  save(request: TransfusionRequest, round: CompatibilityRound, finalize: boolean): Promise<TransfusionRequest>;
  communicate(request: TransfusionRequest, round: CompatibilityRound): Promise<TransfusionRequest>;
}

const componentByUuid = new Map<string, ComponentType>([
  ['34797281-edc3-5f5d-838f-0ec78bc40532', 'wholeBlood'],
  ['51e73781-e839-5973-aa5d-71205285447a', 'redCells'],
  ['6ab25f7c-f5ae-5aa9-8a30-2e84134f0929', 'freshFrozenPlasma'],
  ['66814350-137d-5754-b70c-0aff8e0e0731', 'cryoprecipitate'],
  ['57b5ad07-f255-5cfe-bb6b-60130fb3f2ec', 'platelets'],
  ['cca08d7d-da1b-5ab7-8f14-35d08d7e0673', 'pediatricFraction'],
  ['0733b2dc-14aa-589f-ba88-903df965ef62', 'lowVolumeRedCells'],
]);
const groupByUuid = new Map([
  ['8afda27f-8a57-4e45-94dd-297c62a0e1dc', 'A'],
  ['ac4abc9d-aea9-4676-ba93-125ffd682c41', 'B'],
  ['ba95eb27-f23e-4587-8a3d-8437e953d374', 'AB'],
  ['fe9c1d29-077d-4923-acc9-f49798b86b76', 'O'],
]);
const rhByUuid = new Map([
  ['b4454bf6-5e67-4235-9507-6875d784656d', '+'],
  ['707bd07e-7d27-4571-ad92-ec419af1a0f4', '-'],
]);

function toRound(row: StoredRound, order: TransfusionOrder): CompatibilityRound {
  return {
    id: row.id,
    revision: row.revision,
    readOnly: !row.writable && !row.communicable,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    labelsPrintRequestedAt: row.labelsPrintRequestedAt ?? undefined,
    communicated: row.communicated ?? undefined,
    sample: { ...row.sample, historyNumber: order.historyNumber },
    identityVerified: row.identityVerified,
    pretransfusionVerified: row.pretransfusionVerified,
    operator: row.operator,
    results: row.results,
  };
}

function toAssignments(row: StoredRound): TransfusionAssignment[] {
  return row.tests.map((test) => {
    const group = groupByUuid.get(test.groupConceptUuid ?? '');
    const rh = rhByUuid.get(test.rhConceptUuid ?? '');
    return {
      unit: {
        id: test.unitCode,
        originalCode: test.unitCode,
        component: test.componentDisplay ?? '',
        componentType: componentByUuid.get(test.componentConceptUuid) ?? null,
        bloodGroup: group && rh ? `${group}${rh}` : '',
        expiresAt: '',
        location: '',
        status: 'En pruebas de compatibilidad',
        screeningResult: 'pending',
        qualityIssues: [],
        canDispose: false,
        sealCode: test.sealCode,
        bagLot: '',
        collectedOn: '',
        screening: { hbsag: '', antiHbc: '', antiHcv: '', hiv: '', htlv: '', chagas: '', syphilis: '' },
      },
      roundId: row.id,
      unitSampleCode: test.unitSampleCode,
      assignedAt: row.createdAt,
      active: true,
      result: test.result,
      resultAt: test.resultAt,
      testedBy: test.testedBy,
    };
  });
}

function statusFor(rounds: CompatibilityRound[], deliveredAt: string | null): TransfusionRequest['status'] {
  if (deliveredAt) return 'delivered';
  if (rounds.some((round) => !round.completedAt)) return 'testing';
  return rounds.some((round) => Object.values(round.results).includes('incompatible')) ? 'incompatible' : 'compatible';
}

function toRequest(order: TransfusionOrder, rows: StoredRound[]): TransfusionRequest {
  const rounds = rows.map((row) => toRound(row, order));
  const sample = rounds[0].sample;
  const deliveredAt = rows.find((row) => row.deliveredAt)?.deliveredAt ?? null;
  return {
    id: order.id,
    issuedOrder: true,
    revision: rounds[0].revision ?? 1,
    status: statusFor(rounds, deliveredAt),
    order,
    draft: {
      reviewer: '',
      reviewVerified: false,
      consentVerified: false,
      sample,
      selectedUnitIds: [],
      selectionVerified: false,
      collectorName: '',
      collectorDocument: '',
      deliveredBy: '',
      releaseVerified: false,
    },
    receivedAt: null,
    sample,
    assignments: rows.flatMap(toAssignments),
    rounds,
    events: [],
    deliveredAt,
    requesterStatus: deliveredAt ? 'ATENDIDA' : 'PENDIENTE',
  };
}

function mergeRound(request: TransfusionRequest, previous: CompatibilityRound, row: StoredRound): TransfusionRequest {
  if (row.requestId !== request.id || row.patientUuid !== request.order.patientId || row.id !== previous.id) {
    throw new Error('COMPATIBILITY_ROUND_MISMATCH');
  }
  const rounds = request.rounds.map((item) => (item.id === row.id ? toRound(row, request.order) : item));
  return {
    ...request,
    revision: row.revision,
    status: statusFor(rounds, row.deliveredAt),
    rounds,
    deliveredAt: row.deliveredAt,
    assignments: [...request.assignments.filter((item) => item.roundId !== row.id), ...toAssignments(row)],
  };
}

export const openmrsCompatibilityApi: PersistedCompatibilityApi = {
  async list() {
    const { data } = await openmrsFetch<StoredRound[]>(`${base}/compatibility`);
    const byRequest = new Map<string, StoredRound[]>();
    for (const row of data) {
      const existing = byRequest.get(row.requestId);
      if (existing && existing[0].patientUuid !== row.patientUuid) throw new Error('COMPATIBILITY_ROUND_MISMATCH');
      if (existing) existing.push(row);
      else byRequest.set(row.requestId, [row]);
    }
    return Promise.all(
      Array.from(byRequest.entries(), async ([id, rows]) =>
        toRequest(await readLinkedFr08(id, rows[0].patientUuid), rows),
      ),
    );
  },
  async save(request, round, finalize) {
    const { data } = await openmrsFetch<StoredRound>(roundUrl(request.id, round.id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: {
        revision: round.revision ?? request.revision,
        identityVerified: round.identityVerified,
        pretransfusionVerified: round.pretransfusionVerified,
        labelsPrintRequestedAt: round.labelsPrintRequestedAt,
        results: round.results,
        finalize,
      },
    });
    return mergeRound(request, round, data);
  },
  async communicate(request, round) {
    const { data } = await openmrsFetch<StoredRound>(`${roundUrl(request.id, round.id)}/communication`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { revision: round.revision ?? request.revision },
    });
    return mergeRound(request, round, data);
  },
};
