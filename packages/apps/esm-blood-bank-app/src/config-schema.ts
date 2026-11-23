import { Type } from '@openmrs/esm-framework';
import { cmvIgGConceptUuid } from './sections/laboratory/screening/screening.types';

export interface CollectionLabelConceptConfig {
  bloodBankServiceUuid?: string;
  campaignServiceUuid?: string;
  anticoagulantSetUuid?: string;
}

export interface PaperConsentConfig {
  donorEncounterTypeUuid: string;
  recipientEncounterTypeUuid: string;
  documentConceptUuid: string;
  donorDocumentConceptUuid?: string;
  encounterRoleUuid: string;
  demoDonorApplicationId?: string;
  demoDonorPatientUuid?: string;
  demoDonorVisitUuid?: string;
}

export interface BloodBankConfig {
  paperConsent?: PaperConsentConfig;
  transfusionOrders?: {
    orderTypeUuid: string;
    conceptUuid: string;
    encounterTypeUuid: string;
    careSettingUuid: string;
    historyIdentifierTypeUuid: string;
    documentIdentifierTypeUuids: string[];
  };
  collectionLabelConcepts?: CollectionLabelConceptConfig;
  inventoryDisposalSignatories?: {
    servicePersonUuid?: string;
    epidemiologyPersonUuid?: string;
  };
  laboratoryCatalogs?: {
    modifierLocationUuid?: string;
    storageTemperatureSetUuid?: string;
    irregularAntibodySetUuid?: string;
    cmvIgGConceptUuid?: string;
  };
  dashboardExpiryWarningDays?: number;
  enabled: boolean;
  useMockData: boolean;
}

export const configSchema = {
  paperConsent: {
    donorEncounterTypeUuid: { _type: Type.String, _default: '6bf0deda-1386-4ba8-97ee-512cb1e12f00' },
    recipientEncounterTypeUuid: { _type: Type.String, _default: '4835195e-8495-4cd5-b289-4031c0d38c73' },
    documentConceptUuid: { _type: Type.String, _default: '859c470f-bfc5-407b-98f0-cabe3450f4c9' },
    donorDocumentConceptUuid: { _type: Type.String, _default: '6bf0deda-1386-4ba8-97ee-512cb1e12f01' },
    encounterRoleUuid: { _type: Type.String, _default: 'a0b03050-c99b-11e0-9572-0800200c9a66' },
    demoDonorApplicationId: { _type: Type.String, _default: '' },
    demoDonorPatientUuid: { _type: Type.String, _default: '' },
    demoDonorVisitUuid: { _type: Type.String, _default: '' },
  },
  transfusionOrders: {
    orderTypeUuid: { _type: Type.String, _default: '', _description: 'UUID del tipo de orden transfusional.' },
    conceptUuid: { _type: Type.String, _default: '', _description: 'UUID del concepto de la solicitud transfusional.' },
    encounterTypeUuid: { _type: Type.String, _default: '', _description: 'UUID del tipo de encuentro de órdenes.' },
    careSettingUuid: {
      _type: Type.String,
      _default: '',
      _description: 'Ámbito de atención de respaldo. El FR08 utiliza el ámbito configurado en Órdenes.',
    },
    historyIdentifierTypeUuid: { _type: Type.String, _default: '', _description: 'UUID del tipo de historia clínica.' },
    documentIdentifierTypeUuids: {
      _type: Type.Array,
      _elements: { _type: Type.UUID },
      _default: [],
      _description: 'Tipos de documento de identidad en orden de preferencia.',
    },
  },
  inventoryDisposalSignatories: {
    servicePersonUuid: {
      _type: Type.String,
      _default: '',
      _description: 'Persona designada como responsable del Banco de Sangre para el acta de eliminación.',
    },
    epidemiologyPersonUuid: {
      _type: Type.String,
      _default: '',
      _description: 'Persona designada como representante de Epidemiología para el acta de eliminación.',
    },
  },
  laboratoryCatalogs: {
    modifierLocationUuid: {
      _type: Type.String,
      _default: '',
      _description: 'UUID de la localidad de OpenMRS que fracciona los hemocomponentes.',
    },
    storageTemperatureSetUuid: {
      _type: Type.String,
      _default: '',
      _description: 'UUID del conjunto de temperaturas de almacenamiento del banco de sangre.',
    },
    irregularAntibodySetUuid: {
      _type: Type.String,
      _default: '',
      _description: 'UUID del conjunto de especificidades de anticuerpos eritrocitarios irregulares.',
    },
    cmvIgGConceptUuid: {
      _type: Type.String,
      _default: cmvIgGConceptUuid,
      _description: 'UUID de la prueba de anticuerpos IgG contra citomegalovirus (CMV).',
    },
  },
  collectionLabelConcepts: {
    bloodBankServiceUuid: {
      _type: Type.String,
      _default: '6bf0deda-1386-4ba8-97ee-512cb1e12f02',
      _description: 'UUID del concepto UPSS Banco de Sangre para la etiqueta de extracción.',
    },
    campaignServiceUuid: {
      _type: Type.String,
      _default: '6bf0deda-1386-4ba8-97ee-512cb1e12f03',
      _description: 'UUID del concepto Campaña de donación para la etiqueta de extracción.',
    },
    anticoagulantSetUuid: {
      _type: Type.String,
      _default: '03b13291-d348-570f-9928-b2143f621c4e',
      _description: 'UUID del conjunto de conceptos de anticoagulantes permitidos en extracción.',
    },
  },
  dashboardExpiryWarningDays: {
    _type: Type.Number,
    _default: 7,
    _description:
      'Días de anticipación del recordatorio operativo de vencimientos en Inicio (1 a 365). No modifica la caducidad ni la aptitud de una unidad.',
  },
  enabled: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Habilita el microfrontend de Banco de Sangre.',
  },
  useMockData: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Usa datos locales mientras la API de Banco de Sangre no esté disponible.',
  },
};
