import { finalNodes } from './fractionation-rules';
import type { FractionationBatch, FractionationNode, FractionationUnit } from './fractionation.types';

function addTime(value: string, days: number, years = 0) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00` : value);
  if (!Number.isFinite(date.getTime())) return '';
  date.setFullYear(date.getFullYear() + years);
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function suggestedExpiration(node: FractionationNode, source: FractionationUnit) {
  const { anticoagulant, preservative, storageTemperature } = node.label;
  const temperature = storageTemperature.replace(/[–−]/g, '-').replace(/\s/g, '');
  if (['wholeBlood', 'pediatricFraction', 'redCells'].includes(node.component) && /\b1-6\b/.test(temperature)) {
    const additive = /\b(SAG[ -]?M|AS[ -]?[135]|ADSOL|NUTRICEL|OPTISOL)\b/i.test(preservative);
    const solution = `${anticoagulant} ${preservative}`;
    const days =
      node.component === 'redCells' && additive
        ? 42
        : /\bCPDA[ -]?1\b/i.test(solution)
          ? 35
          : /\b(CPD|ACD|CP2D)\b/i.test(solution)
            ? 21
            : 0;
    const expiration = days ? addTime(source.collectedAt, days) : '';
    const sourceExpiration = addTime(source.label.expiresAt, 0);
    return node.component !== 'redCells' && sourceExpiration && expiration && sourceExpiration < expiration
      ? sourceExpiration
      : expiration;
  }
  if (node.component === 'freshFrozenPlasma' && /-65\b/.test(temperature)) return addTime(source.collectedAt, 0, 7);
  if (['freshFrozenPlasma', 'plasma24', 'cryoprecipitate'].includes(node.component) && /-18\b/.test(temperature))
    return addTime(source.collectedAt, 0, 1);
  return '';
}

/** Suggested dates for the documented EG05-TB02 conditions. Keep saved manual dates. */
export function suggestFractionationExpirations(batch: FractionationBatch): FractionationBatch {
  if (batch.system === 'open') return batch;
  const leaves = finalNodes(batch);
  const suggestions = new Map<string, string>();
  const manual = (node: FractionationNode) => node.label.expiresAtManual ?? Boolean(node.label.expiresAt);
  for (const node of leaves) {
    const source = batch.sources.find(({ id }) => id === node.sourceId);
    if (source && !manual(node)) suggestions.set(node.id, suggestedExpiration(node, source));
  }
  for (const node of leaves) {
    if (node.component !== 'liquidPlasma' || manual(node)) continue;
    const sibling = leaves.find((item) => item.parentId === node.parentId && item.component === 'redCells');
    const refrigerated = /\b1\s*[–-]\s*6\b/.test(node.label.storageTemperature);
    if (sibling && refrigerated)
      suggestions.set(node.id, addTime(suggestions.get(sibling.id) ?? sibling.label.expiresAt, 5));
  }
  return {
    ...batch,
    nodes: batch.nodes.map((node) =>
      suggestions.has(node.id)
        ? { ...node, label: { ...node.label, expiresAt: suggestions.get(node.id) ?? '', expiresAtManual: false } }
        : node,
    ),
  };
}
