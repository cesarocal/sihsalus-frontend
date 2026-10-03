export const moduleName = '@sihsalus/esm-blood-bank-app';
export const featureName = 'blood-bank';
export const appName = 'esm-blood-bank-app';
export const basePath = '/blood-bank';
export const donorsPath = '/donors';
export const donorDetailRoute = 'donors/:donorId';
export const donorDetailPath = (id: string) => `${donorsPath}/${encodeURIComponent(id)}`;
export const applicantSelectionPath = '/applicant-selection';
