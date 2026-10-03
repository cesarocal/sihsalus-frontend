import { showSnackbar } from '@openmrs/esm-framework';

/** The OpenMRS shell owns positioning, dismissal and the notification host. */
export function notifySuccess(title: string) {
  showSnackbar({ title, kind: 'success', isLowContrast: true, autoClose: true, timeoutInMs: 5000 });
}
