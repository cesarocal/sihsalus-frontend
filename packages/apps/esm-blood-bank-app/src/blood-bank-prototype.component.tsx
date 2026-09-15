import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeftNav } from '@openmrs/esm-framework';

import type { BloodBankConfig } from './config-schema';
import { moduleName } from './constants';
import { Dashboard } from './dashboard.component';
import { DonorDetail, Donors } from './donors.component';
import { donors } from './prototype-data';
import { Selection } from './selection.component';
import { DonorFollowup, RecipientFollowup } from './follow-up.component';
import type { PrototypeView } from './types';
import { Audit, Collection, FractionationPlans, Inventory, Reactions, Transfusion } from './workflow-pages.component';
import styles from './root.scss';

const navigationViews: PrototypeView[] = ['dashboard', 'donors', 'selection', 'collection', 'processing', 'inventory', 'donor-followup', 'recipient-followup', 'transfusion', 'reactions', 'audit'];

export function BloodBankPrototype({ title }: BloodBankConfig) {
  const { t } = useTranslation(moduleName);
  const [activeView, setActiveView] = useState<PrototypeView>('dashboard');
  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null);

  useLeftNav({
    name: 'blood-bank-navigation-slot',
    basePath: globalThis.spaBase ?? '',
    mode: 'normal',
  });

  useEffect(() => {
    const handleNavigation = (event: Event) => {
      const view = (event as CustomEvent<{ view?: PrototypeView }>).detail?.view;
      if (view && navigationViews.includes(view)) {
        setActiveView(view);
        if (view === 'donors') setSelectedDonorId(null);
      }
    };

    globalThis.addEventListener('sihsalus:blood-bank:navigate', handleNavigation);
    return () => globalThis.removeEventListener('sihsalus:blood-bank:navigate', handleNavigation);
  }, []);

  const content = (() => {
    switch (activeView) {
      case 'donors': {
        const donor = selectedDonorId ? donors.find((item) => item.id === selectedDonorId) : undefined;
        return donor ? <DonorDetail donor={donor} onBack={() => setSelectedDonorId(null)} /> : <Donors onSelectDonor={setSelectedDonorId} />;
      }
      case 'selection': return <Selection />;
      case 'collection': return <Collection />;
      case 'processing': return <FractionationPlans />;
      case 'inventory': return <Inventory />;
      case 'donor-followup': return <DonorFollowup />;
      case 'recipient-followup': return <RecipientFollowup />;
      case 'transfusion': return <Transfusion />;
      case 'reactions': return <Reactions />;
      case 'audit': return <Audit />;
      default: return <Dashboard onNavigate={setActiveView} />;
    }
  })();

  return (
    <main className={styles.root}>
      <div className={styles.mainColumn}>
        {activeView === 'dashboard' && (
          <header className={styles.appHeader}>
            <div>
              <p className={styles.eyebrow}>{t('sihSalusClinicalModule', 'Módulo clínico SIH Salus')}</p>
              <h1>{t('appTitle', title)}</h1>
              <p>{t('appDescription', 'Módulo para selección, procesamiento, inventario y transfusión.')}</p>
            </div>
          </header>
        )}
        <div className={styles.content}>{content}</div>
      </div>
    </main>
  );
}
