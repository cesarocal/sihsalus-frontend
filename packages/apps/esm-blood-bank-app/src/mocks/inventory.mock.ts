import type { ProcessingState } from '../api/mock-processing-store';
import { newCollection } from '../sections/collection/collection-rules';
import { inventoryExpiry } from '../sections/inventory/inventory-rules';
import type { ComponentType, FractionationUnit } from '../sections/laboratory/fractionation/fractionation.types';
import { screeningTests } from '../sections/laboratory/screening/screening.types';
import {
  globalScreeningResult,
  localDateTime,
  newScreening,
  validateScreening,
} from '../sections/laboratory/screening/screening-rules';
import { applicationsMock } from './applicant-selection.mock';

/** Synthetic stock only. Never replace a saved unit, panel or collection. Reads do not write storage. */
export function withInventoryFixtures(previous: ProcessingState): ProcessingState {
  const state = structuredClone(previous);
  state.fractionation ??= { units: [], batches: [] };
  const store = state.fractionation;
  const day = localDateTime().slice(0, 10);
  const collected = new Date(`${day}T12:00`);
  collected.setDate(collected.getDate() - 1);
  const date = new Date(collected.getTime() - collected.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const expires = new Date(`${day}T12:00`);
  expires.setDate(expires.getDate() + 7);
  const expiry = new Date(expires.getTime() - expires.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  for (let number = 1; number <= 25; number++) {
    const additional = number > 5;
    const code = additional
      ? `BB-TX-DEMO-${String(number - 5).padStart(3, '0')}`
      : `BB-SELLO-DEMO-${String(number).padStart(3, '0')}`;
    const component: ComponentType =
      number <= 5
        ? 'wholeBlood'
        : number <= 11
          ? 'redCells'
          : number <= 15
            ? 'wholeBlood'
            : number <= 19
              ? 'freshFrozenPlasma'
              : number <= 22
                ? 'platelets'
                : 'cryoprecipitate';
    const groups = [
      'O+',
      'O+',
      'O+',
      'O+',
      'A+',
      'O-',
      'A+',
      'A+',
      'O+',
      'B+',
      'O+',
      'A+',
      'AB+',
      'B+',
      'O+',
      'A+',
      'B+',
      'O+',
      'A+',
      'AB+',
    ] as const;
    const bloodGroup = additional ? groups[number - 6] : number % 2 ? 'O+' : 'A+';
    const reactive = number === 4 || number === 5;
    const collectionId = `mock-inventory-seal-${number}`;
    const panelId = `mock-screening-${collectionId}`;
    // Do not invent approvals for partial/edited fixtures or resurrect units removed from storage.
    if (
      state.collections.some((item) => item.id === collectionId || item.unitCode === code) ||
      state.screenings.some((item) => item.id === panelId || item.unitCode === code) ||
      store.units.some((item) => item.id === code || item.code === code)
    )
      continue;
    const application = applicationsMock().find((item) => item.status === 'selected');
    if (!application) throw new Error('MOCK_FIXTURE_MISSING');
    application.id = collectionId;
    application.number = `SELLO-DEMO-${String(number).padStart(3, '0')}`;
    application.admission.date = date;
    application.admission.documentNumber = additional ? String(90001000 + number) : `9000010${number}`;
    application.personal.givenName = `Persona DEMO ${number}`;
    application.personal.familyName = 'Inventario sintético';
    application.physical.bloodGroup = bloodGroup.slice(0, -1) as typeof application.physical.bloodGroup;
    application.physical.rh = bloodGroup.endsWith('-') ? '-' : '+';
    const collection = newCollection(application);
    collection.id = collectionId;
    collection.unitCode = code;
    if (additional) collection.sampleCode = `M-STOCK-${code}`;
    collection.label = {
      ...collection.label,
      component: additional ? `${component} (DEMO)` : 'Sangre total (DEMO)',
      anticoagulant: 'CPDA-1 (DEMO)',
      plannedVolume: '450',
      service: 'Banco de sangre (DEMO)',
      collectedBy: 'Profesional DEMO',
      sampleType: 'Sangre (DEMO)',
      sampleContainer: 'Tubo (DEMO)',
    };
    collection.extractedVolume = '450';
    collection.registry = {
      ...collection.registry,
      date,
      bagLot: 'LOTE-DEMO',
      complications: 'no',
      extractionStatus: 'complete',
      attendedBy: 'Profesional DEMO',
    };
    collection.certificate.emailConsent = 'no';
    collection.completedSteps = ['label', 'volume', 'registry', 'certificate'];
    collection.status = 'completed';
    collection.unitStatus = 'quarantine';
    collection.revision = 1;
    collection.updatedAt = new Date(`${date}T12:00`).toISOString();
    const panel = newScreening(collection);
    panel.collectedOn = `${date}T09:00`;
    panel.receivedOn = `${date}T10:00`;
    panel.receivedBy = 'Recepción DEMO';
    panel.identityVerified = true;
    panel.performedOn = `${date}T11:00`;
    panel.performedBy = 'Laboratorio DEMO';
    for (const test of screeningTests)
      panel.tests[test] = {
        result: reactive && test === 'hiv' ? 'reactive' : 'nonReactive',
        reagent: 'Reactivo DEMO',
        brand: 'Marca DEMO',
        lot: 'LOTE-DEMO',
      };
    panel.validatedBy = 'Validación DEMO';
    panel.validatedAt = collection.updatedAt;
    panel.result = reactive ? 'reactive' : 'nonReactive';
    panel.status = 'validated';
    panel.completedSteps = ['reception', 'results', 'validation'];
    const unit: FractionationUnit = {
      id: code,
      code,
      originalWholeBloodCode: code,
      component,
      volume: '450',
      nominalVolume: '450',
      collectedAt: date,
      location: collection.label.service,
      state: 'quarantine',
      label: {
        anticoagulant: collection.label.anticoagulant,
        preservative: '',
        sedimentingAgent: '',
        collectionService: collection.label.service,
        processingService: '',
        storageTemperature: 'DEMO',
        expiresAt: expiry,
        bloodGroup,
        antibodies: '',
        voluntary: true,
        remunerated: false,
        leukocytesReduced: false,
        autologous: false,
        recipientName: '',
        recipientDocument: '',
        recipientService: '',
        recipientHistory: '',
      },
    };
    state.collections.push(collection);
    state.screenings.push(panel);
    store.units.push(unit);
  }
  // Initial mock stock approvals, not print/confirmation events performed by an operator.
  // Also enrich older tabs without resetting records, pending seals or stock movements.
  for (let number = 1; number <= 20; number++) {
    const code = `BB-TX-DEMO-${String(number).padStart(3, '0')}`;
    if (
      state.fixtureQualitySeals?.[code] ||
      state.inventory?.operations.some((op) => op.units.some((unit) => unit.id === code))
    )
      continue;
    const unit = store.units.find((item) => item.code === code && item.id === code);
    const collection = state.collections.find(
      (item) => item.id === `mock-inventory-seal-${number + 5}` && item.unitCode === code,
    );
    const panels = state.screenings.filter((panel) => panel.unitCode === code);
    const expiration = unit ? inventoryExpiry(unit.label.expiresAt) : '';
    if (
      !unit ||
      unit.originalWholeBloodCode !== code ||
      unit.state !== 'quarantine' ||
      !collection ||
      collection.application.admission.donationType === 'autologous' ||
      unit.label.autologous ||
      !expiration ||
      expiration < day ||
      new Date(unit.label.expiresAt).getTime() <= Date.now() ||
      !/^(A|B|AB|O)[+−-]$/.test(unit.label.bloodGroup) ||
      !unit.location.trim() ||
      !panels.length ||
      panels.some(
        (panel) =>
          panel.collectionId !== collection.id ||
          (panel.origin && (panel.origin.type !== 'postExtraction' || panel.origin.collectionId !== collection.id)) ||
          panel.status !== 'validated' ||
          !panel.validatedAt ||
          !Number.isFinite(Date.parse(panel.validatedAt)) ||
          Date.parse(panel.validatedAt) > Date.now() ||
          Date.parse(panel.validatedAt) < Date.parse(panel.performedOn) ||
          panel.result !== 'nonReactive' ||
          globalScreeningResult(panel) !== 'nonReactive' ||
          validateScreening(panel, 'validation').length,
      )
    )
      continue;
    state.fixtureQualitySeals ??= {};
    state.fixtureQualitySeals[code] = `Q-TX-DEMO-${String(number).padStart(3, '0')}`;
  }
  return state;
}
