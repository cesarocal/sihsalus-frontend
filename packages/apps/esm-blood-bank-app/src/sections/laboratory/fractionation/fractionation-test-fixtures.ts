import type { FractionationApi } from '../../../api/fractionation.api';
import { finalNodes, splitNode } from './fractionation-rules';
import type { FractionationBatch } from './fractionation.types';

/** Synthetic fixtures only. Dates and volumes are test inputs, not clinical defaults. */
export function plannedBatch(input: FractionationBatch) {
  let batch = structuredClone(input);
  for (const source of batch.sources) {
    batch = splitNode(batch, `${source.id}:root`, 0);
    if (source.component === 'wholeBlood') batch = splitNode(batch, `${source.id}:root:plateletRichPlasma`, 0);
  }
  batch.operator = 'Profesional DEMO';
  batch.service = 'Laboratorio DEMO';
  batch.system = 'closed';
  batch.nodes = batch.nodes.map((node) =>
    node.parentId === null ? node : { ...node, label: { ...node.label, processingService: batch.service } },
  );
  return batch;
}
export function labeledBatch(input: FractionationBatch) {
  const batch = structuredClone(input);
  for (const node of finalNodes(batch)) {
    node.estimatedVolume = node.component === 'cryoprecipitate' ? '30' : '100';
    node.label.expiresAt = '2099-01-01T12:00';
    node.label.antibodies = 'No detectados (DEMO)';
  }
  batch.labelsVerified = true;
  return batch;
}
export async function reviewBatch(api: FractionationApi, input: FractionationBatch) {
  let batch = await api.save(plannedBatch(input), 'fractionationPlan');
  batch = await api.save(labeledBatch(batch), 'fractionationLabels');
  for (const node of finalNodes(batch)) node.volume = node.estimatedVolume;
  batch = await api.save(batch, 'fractionationVolumes');
  batch.finalChecks = true;
  return batch;
}
