import { Type } from '@openmrs/esm-framework';

export interface CollectionLabelConceptConfig {
  bloodBankServiceUuid?: string;
  campaignServiceUuid?: string;
  anticoagulantSetUuid?: string;
}

export interface BloodBankConfig {
  collectionLabelConcepts?: CollectionLabelConceptConfig;
  dashboardExpiryWarningDays?: number;
  enabled: boolean;
  useMockData: boolean;
}

export const configSchema = {
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
