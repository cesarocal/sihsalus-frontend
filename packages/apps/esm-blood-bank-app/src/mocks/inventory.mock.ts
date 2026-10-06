import type { ProcessingState } from '../api/mock-processing-store';
import { newCollection } from '../sections/collection/collection-rules';
import type { FractionationUnit } from '../sections/laboratory/fractionation/fractionation.types';
import { localDateTime, newScreening } from '../sections/laboratory/screening/screening-rules';
import { screeningTests } from '../sections/laboratory/screening/screening.types';
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
  for (const number of [1, 2, 3, 4, 5]) {
    const code = `BB-SELLO-DEMO-${String(number).padStart(3, '0')}`;
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
    application.admission.documentNumber = `9000010${number}`;
    application.personal.givenName = `Persona DEMO ${number}`;
    application.personal.familyName = 'Inventario sintético';
    application.physical.bloodGroup = number % 2 ? 'O' : 'A';
    application.physical.rh = '+';
    const collection = newCollection(application);
    collection.id = collectionId;
    collection.label = {
      ...collection.label,
      component: 'Sangre total (DEMO)',
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
        result: number > 3 && test === 'hiv' ? 'reactive' : 'nonReactive',
        reagent: 'Reactivo DEMO',
        brand: 'Marca DEMO',
        lot: 'LOTE-DEMO',
      };
    panel.validatedBy = 'Validación DEMO';
    panel.validatedAt = collection.updatedAt;
    panel.result = number > 3 ? 'reactive' : 'nonReactive';
    panel.status = 'validated';
    panel.completedSteps = ['reception', 'results', 'validation'];
    const unit: FractionationUnit = {
      id: code,
      code,
      originalWholeBloodCode: code,
      component: 'wholeBlood',
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
        bloodGroup: `${application.physical.bloodGroup}+`,
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
  return state;
}
