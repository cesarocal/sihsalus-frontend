import { Type } from '@openmrs/esm-framework';

export interface BloodBankConfig {
  enabled: boolean;
  title: string;
  selectionFormVersion: string;
  prototypeMode: boolean;
}

export const configSchema = {
  enabled: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Controls whether the blood bank module is available.',
  },
  title: {
    _type: Type.String,
    _default: 'Banco de Sangre',
    _description: 'Title shown on the blood bank landing page.',
  },
  selectionFormVersion: {
    _type: Type.String,
    _default: 'R.M. N.° 241-2018-MINSA · Anexo 1',
    _description: 'Approved selection form version displayed and recorded by the prototype.',
  },
  prototypeMode: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Keeps the module in synthetic-data prototype mode.',
  },
};
