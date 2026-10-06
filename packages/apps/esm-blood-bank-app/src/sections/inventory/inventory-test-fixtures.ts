import { readProcessingState, writeProcessingState } from '../../api/mock-processing-store';
import { localDateTime, newScreening } from '../laboratory/screening/screening-rules';
import { screeningTests } from '../laboratory/screening/screening.types';
import { newInventoryOperation } from './inventory-rules';
import type { InventoryUnit } from './inventory.types';

/** Explicit test setup only. Never imported by the application or used to approve a pending clinical panel. */
export function seedInventoryReadyUnits() {
  const state = readProcessingState(() => sessionStorage);
  for (const number of [2, 3]) {
    const collection = structuredClone(state.collections[0]);
    collection.id = `inventory-test-collection-${number}`;
    collection.unitCode = `ST-DEMO-00${number}`;
    collection.sampleCode = `M-INVENTORY-DEMO-${number}`;
    const panel = newScreening(collection);
    panel.collectedOn = `${localDateTime().slice(0, 10)}T00:00`;
    panel.receivedOn = localDateTime();
    panel.receivedBy = 'Recepción DEMO';
    panel.identityVerified = true;
    panel.performedOn = localDateTime();
    panel.performedBy = 'Laboratorio DEMO';
    for (const test of screeningTests)
      panel.tests[test] = {
        result: 'nonReactive',
        reagent: 'Reactivo DEMO',
        brand: 'Marca DEMO',
        lot: 'LOTE-DEMO',
      };
    panel.validatedBy = 'Validación DEMO';
    panel.validatedAt = new Date().toISOString();
    panel.result = 'nonReactive';
    panel.status = 'validated';
    panel.completedSteps = ['reception', 'results', 'validation'];
    state.collections.push(collection);
    state.screenings.push(panel);
  }
  writeProcessingState(() => sessionStorage, state);
}
export function sealOperation(units: InventoryUnit[]) {
  return {
    ...newInventoryOperation('qualitySeal', units),
    serviceResponsible: 'Profesional DEMO',
    labelsVerified: true,
    integrityVerified: true,
    recordsVerified: true,
  };
}
export function disposalOperation(units: InventoryUnit[]) {
  return {
    ...newInventoryOperation('disposal', units),
    serviceResponsible: 'Servicio DEMO',
    epidemiologyResponsible: 'Epidemiología DEMO',
    witnesses: 'Testigos DEMO',
    causes: Object.fromEntries(units.map((unit) => [unit.id, 'hemolysis'])),
  };
}
