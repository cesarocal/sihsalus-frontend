import { bloodBankPrivileges, type BloodBankPrivilege } from '../access/blood-bank-privileges';

export interface NavigationItem {
  labelKey: string;
  defaultLabel: string;
  path: string;
  privilege: BloodBankPrivilege;
  children?: NavigationItem[];
}

export const bloodBankNavigation: NavigationItem[] = [
  { labelKey: 'home', defaultLabel: 'Inicio', path: '/', privilege: bloodBankPrivileges.module },
  { labelKey: 'donors', defaultLabel: 'Donantes', path: '/donors', privilege: bloodBankPrivileges.donors },
  { labelKey: 'applicantSelection', defaultLabel: 'Selección del postulante', path: '/applicant-selection', privilege: bloodBankPrivileges.applicantSelection },
  { labelKey: 'collectionAndApheresis', defaultLabel: 'Extracción y aféresis', path: '/collection', privilege: bloodBankPrivileges.collection },
  {
    labelKey: 'laboratory',
    defaultLabel: 'Laboratorio',
    path: '/laboratory',
    privilege: bloodBankPrivileges.screening,
    children: [
      { labelKey: 'donorScreening', defaultLabel: 'Tamizaje de donantes', path: '/laboratory/screening', privilege: bloodBankPrivileges.screening },
      { labelKey: 'compatibility', defaultLabel: 'Compatibilidad', path: '/laboratory/compatibility', privilege: bloodBankPrivileges.compatibility },
      { labelKey: 'fractionation', defaultLabel: 'Fraccionamiento', path: '/laboratory/fractionation', privilege: bloodBankPrivileges.fractionation },
    ],
  },
  {
    labelKey: 'followUps',
    defaultLabel: 'Seguimientos',
    path: '/follow-up',
    privilege: bloodBankPrivileges.donorFollowUp,
    children: [
      { labelKey: 'donorFollowUp', defaultLabel: 'Donante', path: '/follow-up/donor', privilege: bloodBankPrivileges.donorFollowUp },
      { labelKey: 'recipientFollowUp', defaultLabel: 'Receptor', path: '/follow-up/recipient', privilege: bloodBankPrivileges.recipientFollowUp },
    ],
  },
  { labelKey: 'transfers', defaultLabel: 'Transferencias', path: '/transfers', privilege: bloodBankPrivileges.transfers },
  { labelKey: 'inventory', defaultLabel: 'Inventario', path: '/inventory', privilege: bloodBankPrivileges.inventory },
  { labelKey: 'transfusions', defaultLabel: 'Transfusiones', path: '/transfusions', privilege: bloodBankPrivileges.transfusions },
];
