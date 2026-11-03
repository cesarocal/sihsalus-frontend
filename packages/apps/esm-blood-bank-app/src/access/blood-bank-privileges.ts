/** These names must match privileges created and assigned to roles in OpenMRS. */
export const bloodBankPrivileges = {
  module: 'app:home.bancoSangre',
  homeSelection: 'app:home.bancoSangre.inicio.seleccionExtraccion',
  homeLaboratory: 'app:home.bancoSangre.inicio.laboratorio',
  homeInventory: 'app:home.bancoSangre.inicio.inventario',
  homeSupervisor: 'app:home.bancoSangre.inicio.responsable',
  donors: 'app:home.bancoSangre.donantes',
  applicantSelection: 'app:home.bancoSangre.seleccionPostulante',
  collection: 'app:home.bancoSangre.extraccionAferesis',
  screening: 'app:home.bancoSangre.laboratorio.tamizaje',
  donorFollowUp: 'app:home.bancoSangre.seguimientoDonante',
  recipientFollowUp: 'app:home.bancoSangre.seguimientoReceptor',
  compatibility: 'app:home.bancoSangre.laboratorio.compatibilidad',
  fractionation: 'app:home.bancoSangre.laboratorio.fraccionamiento',
  transfers: 'app:home.bancoSangre.transferencias',
  inventory: 'app:home.bancoSangre.inventario',
  transfusions: 'app:home.bancoSangre.transfusiones',
} as const;

export type BloodBankPrivilege = (typeof bloodBankPrivileges)[keyof typeof bloodBankPrivileges];
