import { SideNavItems, SideNavLink, SideNavMenu, SideNavMenuItem } from '@carbon/react';
import {
  Document,
  Home,
  InventoryManagement,
  SendAlt,
  SettingsAdjust,
  StoragePool,
  UserMultiple,
  UserFollow,
  WarningAlt,
} from '@carbon/react/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from './constants';
import type { PrototypeView } from './types';

const navigation: Array<{ view: PrototypeView; key: string; fallback: string; icon: typeof Document }> = [
  { view: 'dashboard', key: 'home', fallback: 'Inicio', icon: Home },
  { view: 'donors', key: 'donors', fallback: 'Donantes', icon: UserFollow },
  { view: 'selection', key: 'selection', fallback: 'Selección del postulante', icon: UserFollow },
  { view: 'collection', key: 'collection', fallback: 'Extracción y aféresis', icon: StoragePool },
  { view: 'processing', key: 'processing', fallback: 'Fraccionamiento', icon: SettingsAdjust },
  { view: 'inventory', key: 'inventory', fallback: 'Inventario', icon: InventoryManagement },
  { view: 'transfusion', key: 'transfusion', fallback: 'Solicitud y entrega', icon: SendAlt },
  { view: 'reactions', key: 'reactions', fallback: 'Reacciones adversas', icon: WarningAlt },
  { view: 'audit', key: 'audit', fallback: 'Trazabilidad', icon: Document },
];

export default function GlobalNavigation() {
  const { t } = useTranslation(moduleName);
  const [activeView, setActiveView] = useState<PrototypeView>('dashboard');

  const navigate = (view: PrototypeView) => {
    setActiveView(view);
    globalThis.dispatchEvent(new CustomEvent('sihsalus:blood-bank:navigate', { detail: { view } }));
  };

  return (
    <SideNavItems>
      {navigation.map((item) => (
        <SideNavLink isActive={activeView === item.view} key={item.view} onClick={() => navigate(item.view)} renderIcon={item.icon}>
          {t(item.key, item.fallback)}
        </SideNavLink>
      ))}
      <SideNavMenu title={t('followup', 'Seguimiento')} renderIcon={UserMultiple}>
        <SideNavMenuItem isActive={activeView === 'donor-followup'} onClick={() => navigate('donor-followup')}>
          {t('donorFollowup', 'Seguimiento al donante')}
        </SideNavMenuItem>
        <SideNavMenuItem isActive={activeView === 'recipient-followup'} onClick={() => navigate('recipient-followup')}>
          {t('recipientFollowup', 'Seguimiento al receptor')}
        </SideNavMenuItem>
      </SideNavMenu>
    </SideNavItems>
  );
}
