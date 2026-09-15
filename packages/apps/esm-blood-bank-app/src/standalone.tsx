import '@carbon/styles/css/styles.css';

import i18n from 'i18next';
import { createRoot } from 'react-dom/client';
import { initReactI18next } from 'react-i18next';

import es from '../translations/es.json';
import { BloodBankPrototype } from './blood-bank-prototype.component';
import { moduleName } from './constants';

void i18n.use(initReactI18next).init({
  lng: 'es',
  fallbackLng: 'es',
  resources: { es: { [moduleName]: es } },
  defaultNS: moduleName,
  interpolation: { escapeValue: false },
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('No se encontró el contenedor del prototipo standalone.');
}

createRoot(container).render(
  <BloodBankPrototype
    enabled
    prototypeMode
    selectionFormVersion="R.M. N.° 241-2018-MINSA · Anexo 1"
    title="Banco de Sangre"
  />,
);
