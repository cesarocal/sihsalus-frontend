import { Type } from '@openmrs/esm-framework';

export interface CollectionLabelConceptConfig {
  bloodBankServiceUuid?: string;
  campaignServiceUuid?: string;
  anticoagulantSetUuid?: string;
}

export interface BloodBankConfig {
  collectionLabelConcepts?: CollectionLabelConceptConfig;
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
