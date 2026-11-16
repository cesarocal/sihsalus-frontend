import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  admissionReportLocationTag: {
    _type: Type.String,
    _default: 'Care UPSS',
    _description: 'OpenMRS location tag used to load the complete UPSS filter catalog.',
  },
  admissionReportPageSize: {
    _type: Type.Number,
    _default: 50,
    _description:
      'REST batch size (1–200) for the care logbook. All pages in the selected period are loaded; this is not a report limit.',
  },
};
