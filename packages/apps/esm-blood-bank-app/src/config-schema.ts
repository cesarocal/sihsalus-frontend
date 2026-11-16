import { Type } from '@openmrs/esm-framework';

export interface CollectionLabelConceptConfig {
  bloodBankServiceUuid?: string;
  campaignServiceUuid?: string;
  anticoagulantSetUuid?: string;
}

export interface BloodBankConfig {
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
  transfusionOrders: {
    orderTypeUuid: { _type: Type.String, _default: '', _description: 'UUID del tipo de orden transfusional.' },
    conceptUuid: { _type: Type.String, _default: '', _description: 'UUID del concepto de la solicitud transfusional.' },
    encounterTypeUuid: { _type: Type.String, _default: '', _description: 'UUID del tipo de encuentro de órdenes.' },
    careSettingUuid: { _type: Type.String, _default: '', _description: 'UUID del ámbito de atención de la orden.' },
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
      _default: '',
      _description: 'UUID de la prueba de anticuerpos IgG contra citomegalovirus (CMV).',
    },
  },
  collectionLabelConcepts: {
    bloodBankServiceUuid: {
      _type: Type.String,
      _default: '',
      _description: 'UUID del concepto UPSS Banco de Sangre para la etiqueta de extracción.',
    },
    campaignServiceUuid: {
      _type: Type.String,
      _default: '',
      _description: 'UUID del concepto Campaña de donación para la etiqueta de extracción.',
    },
    anticoagulantSetUuid: {
      _type: Type.String,
      _default: '',
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
