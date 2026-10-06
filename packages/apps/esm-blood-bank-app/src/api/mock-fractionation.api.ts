import spanish from '../../translations/es.json';
import {
  componentDefinitions,
  eligibleSource,
  finalNodes,
  newBatch,
  positiveVolume,
  validTree,
  validateFractionation,
} from '../sections/laboratory/fractionation/fractionation-rules';
import {
  fractionationSteps,
  type ComponentLabel,
  type FractionationBatch,
  type FractionationStore,
  type FractionationUnit,
} from '../sections/laboratory/fractionation/fractionation.types';
import type { InventorySummary } from '../types/blood-bank.types';
import type { FractionationApi } from './fractionation.api';
import {
  readProcessingState,
  writeProcessingState,
  type MockStorage,
  type ProcessingState,
} from './mock-processing-store';

const emptyLabel = (): ComponentLabel => ({
  anticoagulant: '',
  preservative: '',
  sedimentingAgent: '',
  collectionService: '',
  processingService: '',
  storageTemperature: '',
  expiresAt: '',
  bloodGroup: '',
  antibodies: '',
  voluntary: false,
  remunerated: false,
  leukocytesReduced: false,
  autologous: false,
  recipientName: '',
  recipientDocument: '',
  recipientService: '',
  recipientHistory: '',
});

/** Additive projection: old session data remains valid; no collections or screening results are reset. */
export function fractionationStore(state: ProcessingState): FractionationStore {
  const store = structuredClone(state.fractionation ?? { units: [], batches: [] });
  if (!Array.isArray(store.units) || !Array.isArray(store.batches) || store.batches.some((batch) => !validTree(batch)))
    throw new Error('INVALID_FRACTIONATION_STORAGE');
  if (
    new Set(store.units.map((unit) => unit.id)).size !== store.units.length ||
    store.units.some(
      (unit) =>
        !componentDefinitions[unit.component] ||
        !['quarantine', 'available', 'inLaboratory', 'fractionated'].includes(unit.state),
    )
  )
    throw new Error('INVALID_FRACTIONATION_STORAGE');
  const sources: FractionationUnit[] = state.collections
    .filter(
      (record) =>
        record.unitStatus === 'quarantine' &&
        record.application.admission.modality === 'wholeBlood' &&
        positiveVolume(record.extractedVolume),
    )
    .map((record) => ({
      id: record.unitCode,
      code: record.unitCode,
      originalWholeBloodCode: record.unitCode,
      component: 'wholeBlood',
      volume: record.extractedVolume,
      nominalVolume: record.label.plannedVolume,
      collectedAt: record.registry.date,
      location: record.label.service,
      state: 'quarantine',
      label: {
        ...emptyLabel(),
        anticoagulant: record.label.anticoagulant,
        preservative: record.label.preservative,
        sedimentingAgent: record.label.sedimentingAgent,
        collectionService: record.label.service,
        bloodGroup: `${record.application.physical.bloodGroup}${record.application.physical.rh}`,
        voluntary: record.application.admission.donationType === 'voluntary',
        leukocytesReduced: record.label.leukocytesReduced,
        autologous: record.application.admission.donationType === 'autologous',
        recipientName: record.label.recipientName,
        recipientDocument: record.label.recipientDocument,
        recipientService: record.label.recipientService,
        recipientHistory: record.label.recipientHistory,
      },
    }));
  for (const number of [2, 3])
    sources.push({
      id: `PFC-2026-00${number}`,
      code: `PFC-2026-00${number}`,
      originalWholeBloodCode: `ST-DEMO-00${number}`,
      component: 'freshFrozenPlasma',
      volume: '250',
      nominalVolume: '250',
      collectedAt: '2026-09-20',
      location: 'Congelador 02 (DEMO)',
      state: 'quarantine',
      label: {
        ...emptyLabel(),
        anticoagulant: 'CPDA-1 (DEMO)',
        collectionService: 'Banco de sangre (DEMO)',
        storageTemperature: '≤ −18 °C',
        expiresAt: '2027-09-20T12:00',
        bloodGroup: number === 2 ? 'A−' : 'O+',
        voluntary: true,
      },
    });
  for (const source of sources) if (!store.units.some((unit) => unit.id === source.id)) store.units.push(source);
  return store;
}

export function fractionationInventory(state: ProcessingState): InventorySummary[] {
  return fractionationStore(state)
    .units.filter((unit) => unit.state !== 'fractionated')
    .map((unit) => ({
      id: unit.code,
      component: (spanish.processing as Record<string, string>)[componentDefinitions[unit.component].key],
      bloodGroup: unit.label.bloodGroup,
      expiresAt: unit.label.expiresAt || '—',
      location: unit.location,
      status:
        unit.state === 'inLaboratory' ? 'En laboratorio' : unit.state === 'available' ? 'Disponible' : 'Cuarentena',
    }));
}

const mutable = (batch: FractionationBatch) => ({
  nodes: batch.nodes,
  operator: batch.operator,
  service: batch.service,
  system: batch.system,
  observations: batch.observations,
  labelsVerified: batch.labelsVerified,
  finalChecks: batch.finalChecks,
});
const plan = (batch: FractionationBatch) =>
  JSON.stringify({
    operator: batch.operator,
    service: batch.service,
    system: batch.system,
    nodes: batch.nodes.map(({ id, sourceId, parentId, component, code }) => ({
      id,
      sourceId,
      parentId,
      component,
      code,
    })),
  });
const labels = (batch: FractionationBatch) =>
  JSON.stringify(
    batch.nodes.map(({ id, label, estimatedVolume }) => ({
      id,
      label,
      estimatedVolume,
    })),
  );
const volumes = (batch: FractionationBatch) => JSON.stringify(batch.nodes.map(({ id, volume }) => ({ id, volume })));

function prepare(input: FractionationBatch, previous: FractionationBatch): FractionationBatch {
  if (input.revision !== previous.revision) throw new Error('FRACTIONATION_CONFLICT');
  if (JSON.stringify(input.sources) !== JSON.stringify(previous.sources))
    throw new Error('FRACTIONATION_IDENTITY_CONFLICT');
  const next = {
    ...structuredClone(previous),
    ...structuredClone(mutable(input)),
  };
  if (
    !validTree(next) ||
    previous.sources.some((source) => {
      const root = next.nodes.find((node) => node.id === `${source.id}:root`);
      return !root || root.volume !== source.volume || JSON.stringify(root.label) !== JSON.stringify(source.label);
    })
  )
    throw new Error('INVALID_FRACTIONATION_TREE');
  for (const node of finalNodes(next)) {
    const source = previous.sources.find((unit) => unit.id === node.sourceId);
    if (!source) throw new Error('FRACTIONATION_IDENTITY_CONFLICT');
    for (const key of [
      'bloodGroup',
      'voluntary',
      'remunerated',
      'leukocytesReduced',
      'autologous',
      'recipientName',
      'recipientDocument',
      'recipientService',
      'recipientHistory',
    ] as const)
      if (node.label[key] !== source.label[key]) throw new Error('FRACTIONATION_IDENTITY_CONFLICT');
  }
  if (plan(next) !== plan(previous)) {
    next.completedSteps = [];
    next.labelsVerified = false;
    next.finalChecks = false;
  } else if (labels(next) !== labels(previous)) {
    next.completedSteps = previous.completedSteps.slice(0, 1);
    next.finalChecks = false;
  } else if (volumes(next) !== volumes(previous)) {
    next.completedSteps = previous.completedSteps.slice(0, 2);
    next.finalChecks = false;
  }
  return next;
}

export function createMockFractionationApi(
  getStorage: () => MockStorage = () => globalThis.sessionStorage,
): FractionationApi {
  const load = () => {
    const state = readProcessingState(getStorage);
    return { state, store: fractionationStore(state) };
  };
  const write = (state: ProcessingState, store: FractionationStore) =>
    writeProcessingState(getStorage, { ...state, fractionation: store });
  return {
    async list() {
      return structuredClone(load().store);
    },
    async start(sourceIds) {
      const { state, store } = load();
      if (!sourceIds.length || new Set(sourceIds).size !== sourceIds.length)
        throw new Error('FRACTIONATION_INVALID_SELECTION');
      const sources = sourceIds.map((id) => store.units.find((unit) => unit.id === id));
      if (
        sources.some((source) => !source || !eligibleSource(source)) ||
        new Set(sources.map((source) => source?.component)).size !== 1
      )
        throw new Error('FRACTIONATION_INVALID_SELECTION');
      const batch = newBatch(
        `F-DEMO-${String(store.batches.length + 1).padStart(5, '0')}`,
        sources as FractionationUnit[],
      );
      for (const unit of store.units)
        if (sourceIds.includes(unit.id)) {
          unit.state = 'inLaboratory';
          unit.batchId = batch.id;
        }
      store.batches.push(batch);
      write(state, store);
      return structuredClone(batch);
    },
    async save(input, step) {
      const { state, store } = load();
      const previous = store.batches.find((batch) => batch.id === input.id);
      if (!previous || previous.status !== 'inProgress') throw new Error('FRACTIONATION_NOT_AVAILABLE');
      const next = prepare(input, previous);
      if (step) {
        const index = fractionationSteps.indexOf(step);
        if (index < 0 || index > next.completedSteps.length || validateFractionation(next, step).length)
          throw new Error('INVALID_FRACTIONATION_STEP');
        next.completedSteps = fractionationSteps.slice(0, index + 1);
      }
      if (
        JSON.stringify(mutable(next)) === JSON.stringify(mutable(previous)) &&
        JSON.stringify(next.completedSteps) === JSON.stringify(previous.completedSteps)
      )
        return structuredClone(previous);
      next.revision += 1;
      next.updatedAt = new Date().toISOString();
      store.batches[store.batches.indexOf(previous)] = next;
      write(state, store);
      return structuredClone(next);
    },
    async finalize(input) {
      const { state, store } = load();
      const previous = store.batches.find((batch) => batch.id === input.id);
      if (!previous) throw new Error('FRACTIONATION_NOT_AVAILABLE');
      if (previous.status === 'completed') return structuredClone(previous); // Idempotent: no duplicate stock movements.
      const next = prepare(input, previous);
      if (next.completedSteps.length < 3 || validateFractionation(next, 'fractionationReview').length)
        throw new Error('INVALID_FRACTIONATION_STEP');
      if (
        next.sources.some(
          (source) =>
            !store.units.some(
              (unit) => unit.id === source.id && unit.state === 'inLaboratory' && unit.batchId === next.id,
            ),
        )
      )
        throw new Error('FRACTIONATION_CONFLICT');
      const leaves = finalNodes(next);
      for (const node of next.nodes.filter((item) => item.parentId !== null)) {
        if (store.units.some((unit) => unit.id === node.id || unit.code === node.code))
          throw new Error('FRACTIONATION_IDENTITY_CONFLICT');
        const source = next.sources.find((unit) => unit.id === node.sourceId);
        if (!source) throw new Error('FRACTIONATION_IDENTITY_CONFLICT');
        const parent = next.nodes.find((item) => item.id === node.parentId);
        if (!parent) throw new Error('FRACTIONATION_IDENTITY_CONFLICT');
        const isFinal = leaves.some((item) => item.id === node.id);
        store.units.push({
          id: node.id,
          code: node.code,
          originalWholeBloodCode: source.originalWholeBloodCode,
          component: node.component,
          volume: isFinal ? node.volume : '',
          nominalVolume: node.estimatedVolume,
          collectedAt: source.collectedAt,
          location: next.service,
          state: isFinal ? 'quarantine' : 'fractionated',
          label: structuredClone(node.label),
          batchId: next.id,
          parentId: parent.parentId === null ? source.id : parent.id,
        });
      }
      for (const unit of store.units)
        if (next.sources.some((source) => source.id === unit.id)) unit.state = 'fractionated';
      next.status = 'completed';
      next.completedSteps = [...fractionationSteps];
      next.revision += 1;
      next.completedAt = new Date().toISOString();
      next.updatedAt = next.completedAt;
      store.batches[store.batches.indexOf(previous)] = next;
      // Parent exit, genealogy, child entry and process completion are one atomic storage operation.
      write(state, store);
      return structuredClone(next);
    },
  };
}
