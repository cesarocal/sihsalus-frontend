import type {
  ComponentType,
  FractionationBatch,
  FractionationNode,
  FractionationStep,
  FractionationUnit,
} from './fractionation.types';
import { fractionationSteps } from './fractionation.types';

/** Local presentation keys, not OpenMRS concept UUIDs or clinical yield rules. */
export const componentDefinitions: Record<
  ComponentType,
  {
    key: string;
    suffix: string;
    color: string;
    fill: number;
    temperature: string;
  }
> = {
  wholeBlood: {
    key: 'componentWholeBlood',
    suffix: 'ST',
    color: '#a2191f',
    fill: 0.86,
    temperature: '',
  },
  redCells: {
    key: 'componentRedCells',
    suffix: 'GR',
    color: '#da1e28',
    fill: 0.65,
    temperature: '1–6 °C',
  },
  plateletRichPlasma: {
    key: 'componentPRP',
    suffix: 'PRP',
    color: '#b28600',
    fill: 0.65,
    temperature: '',
  },
  platelets: {
    key: 'componentPlatelets',
    suffix: 'CP',
    color: '#8a6d00',
    fill: 0.25,
    temperature: '20–24 °C',
  },
  freshFrozenPlasma: {
    key: 'componentPFC',
    suffix: 'PFC',
    color: '#b28600',
    fill: 0.6,
    temperature: '≤ −18 °C',
  },
  plasma24: {
    key: 'componentPlasma24',
    suffix: 'P24',
    color: '#a56eff',
    fill: 0.6,
    temperature: '≤ −18 °C',
  },
  cryoprecipitate: {
    key: 'componentCryo',
    suffix: 'CRIO',
    color: '#009d9a',
    fill: 0.15,
    temperature: '≤ −18 °C',
  },
  cryoReducedPlasma: {
    key: 'componentReducedPlasma',
    suffix: 'PCR',
    color: '#8a6d00',
    fill: 0.5,
    temperature: '≤ −18 °C',
  },
};

export const separationOptions: Partial<Record<ComponentType, ComponentType[][]>> = {
  wholeBlood: [['redCells', 'plateletRichPlasma']],
  plateletRichPlasma: [
    ['platelets', 'freshFrozenPlasma'],
    ['platelets', 'plasma24'],
  ],
  freshFrozenPlasma: [['cryoprecipitate', 'cryoReducedPlasma']],
};

export const positiveVolume = (value: string) =>
  /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 999999.99;
export const finalNodes = (batch: FractionationBatch) =>
  batch.nodes.filter((node) => !batch.nodes.some((child) => child.parentId === node.id));
export const eligibleSource = (unit: FractionationUnit) =>
  ['wholeBlood', 'freshFrozenPlasma'].includes(unit.component) &&
  ['quarantine', 'available'].includes(unit.state) &&
  positiveVolume(unit.volume) &&
  (!unit.label.expiresAt ||
    (Number.isFinite(Date.parse(unit.label.expiresAt)) && Date.parse(unit.label.expiresAt) > Date.now()));

export function newBatch(id: string, sources: FractionationUnit[]): FractionationBatch {
  const now = new Date().toISOString();
  return {
    id,
    revision: 1,
    sources: structuredClone(sources),
    nodes: sources.map((source) => ({
      id: `${source.id}:root`,
      sourceId: source.id,
      parentId: null,
      component: source.component,
      code: source.code,
      volume: source.volume,
      estimatedVolume: source.volume,
      label: structuredClone(source.label),
    })),
    completedSteps: [],
    status: 'inProgress',
    operator: '',
    service: '',
    system: '',
    observations: '',
    labelsVerified: false,
    finalChecks: false,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

/** Branches are alternatives, never pooled. Clearing a branch also clears its descendants. */
export function splitNode(batch: FractionationBatch, id: string, option: number | null): FractionationBatch {
  const next = structuredClone(batch);
  const node = next.nodes.find((item) => item.id === id);
  if (!node) throw new Error('INVALID_FRACTIONATION_TREE');
  const descendants = new Set([id]);
  let previousSize = 0;
  while (descendants.size !== previousSize) {
    previousSize = descendants.size;
    for (const child of next.nodes) if (child.parentId && descendants.has(child.parentId)) descendants.add(child.id);
  }
  next.nodes = next.nodes.filter((item) => item.id === id || !descendants.has(item.id));
  if (option !== null) {
    const components = separationOptions[node.component]?.[option];
    if (!components) throw new Error('INVALID_FRACTIONATION_TREE');
    next.nodes.push(
      ...components.map((component) => ({
        id: `${id}:${component}`,
        sourceId: node.sourceId,
        parentId: id,
        component,
        code: `${node.code}-${componentDefinitions[component].suffix}`,
        estimatedVolume: '',
        volume: '',
        label: {
          ...node.label,
          expiresAt: '',
          storageTemperature: componentDefinitions[component].temperature,
          antibodies: component === 'cryoprecipitate' ? '' : node.label.antibodies,
        },
      })),
    );
  }
  return {
    ...next,
    completedSteps: [],
    labelsVerified: false,
    finalChecks: false,
  };
}

/** Validate topology even on draft writes; client data cannot introduce untracked sources or cycles. */
export function validTree(batch: FractionationBatch): boolean {
  if (
    !Array.isArray(batch.sources) ||
    !batch.sources.length ||
    new Set(batch.sources.map((source) => source.id)).size !== batch.sources.length ||
    batch.sources.some((source) => !['wholeBlood', 'freshFrozenPlasma'].includes(source.component)) ||
    !Array.isArray(batch.nodes) ||
    batch.nodes.length > batch.sources.length * 9
  )
    return false;
  const ids = new Set(batch.nodes.map((node) => node.id));
  const codes = new Set(batch.nodes.map((node) => node.code));
  if (ids.size !== batch.nodes.length || codes.size !== batch.nodes.length) return false;
  return (
    batch.sources.every((source) => {
      const root = batch.nodes.find((node) => node.id === `${source.id}:root`);
      if (
        !root ||
        root.parentId !== null ||
        root.sourceId !== source.id ||
        root.code !== source.code ||
        root.component !== source.component
      )
        return false;
      const reachable = new Set<string>();
      const visit = (node: FractionationNode): boolean => {
        if (reachable.has(node.id) || node.sourceId !== source.id) return false;
        reachable.add(node.id);
        const children = batch.nodes.filter((child) => child.parentId === node.id);
        if (
          children.length &&
          !separationOptions[node.component]?.some(
            (option) =>
              option.length === children.length &&
              option.every((component) => children.some((child) => child.component === component)),
          )
        )
          return false;
        return children.every(
          (child) =>
            child.id === `${node.id}:${child.component}` &&
            child.code === `${node.code}-${componentDefinitions[child.component].suffix}` &&
            visit(child),
        );
      };
      return visit(root) && reachable.size === batch.nodes.filter((node) => node.sourceId === source.id).length;
    }) && batch.nodes.every((node) => batch.sources.some((source) => source.id === node.sourceId))
  );
}

export function validateFractionation(batch: FractionationBatch, step: FractionationStep): string[] {
  const errors = new Set<string>();
  const end = fractionationSteps.indexOf(step);
  const leaves = finalNodes(batch);
  if (!validTree(batch)) return ['fractionationInvalidTree'];
  if (!batch.operator.trim() || !batch.service.trim() || !['open', 'closed'].includes(batch.system))
    errors.add('fractionationProcessRequired');
  if (leaves.some((node) => node.parentId === null)) errors.add('fractionationFinishBranches');
  // EG05-CC07 E7: the general multi-component flow does not implement low-volume red-cell preparation.
  if (
    batch.sources.some(
      (source) =>
        source.component === 'wholeBlood' &&
        Number(source.volume) >= 300 &&
        Number(source.volume) <= 400 &&
        Number(source.nominalVolume) === 450,
    )
  )
    errors.add('fractionationLowVolume');
  if (end >= 1) {
    for (const node of leaves) {
      const label = node.label;
      if (
        !positiveVolume(node.estimatedVolume) ||
        !(label.anticoagulant.trim() || label.preservative.trim()) ||
        !label.collectionService.trim() ||
        !label.processingService.trim() ||
        !label.storageTemperature.trim() ||
        !label.bloodGroup.trim() ||
        !label.expiresAt ||
        !Number.isFinite(Date.parse(label.expiresAt)) ||
        Date.parse(label.expiresAt) <= Date.now() ||
        (node.component !== 'cryoprecipitate' && !label.antibodies.trim()) ||
        (label.autologous && (!label.recipientName.trim() || !label.recipientDocument.trim()))
      )
        errors.add('fractionationLabelsRequired');
    }
    if (!batch.labelsVerified) errors.add('fractionationVerifyLabels');
    for (const source of batch.sources) {
      if (
        leaves
          .filter((node) => node.sourceId === source.id)
          .reduce((sum, node) => sum + Math.round(Number(node.estimatedVolume || 0) * 100), 0) >
        Math.round(Number(source.volume) * 100)
      )
        errors.add('fractionationVolumeExceeded');
    }
  }
  if (end >= 2) {
    for (const source of batch.sources) {
      const results = leaves.filter((node) => node.sourceId === source.id);
      if (results.some((node) => !positiveVolume(node.volume))) errors.add('fractionationVolumesRequired');
      if (
        results.reduce((total, node) => total + Math.round(Number(node.volume || 0) * 100), 0) >
        Math.round(Number(source.volume) * 100)
      )
        errors.add('fractionationVolumeExceeded');
    }
  }
  if (end >= 3 && !batch.finalChecks) errors.add('fractionationFinalChecksRequired');
  return [...errors];
}
