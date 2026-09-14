import { Button, InlineLoading, InlineNotification, Tile } from '@carbon/react';
import {
  ExtensionSlot,
  InPatientPictogram,
  type Location,
  PageHeader,
  PageHeaderContent,
} from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { dashboardMeta } from '../dashboard.meta';
import useWardLocation from '../hooks/useWardLocation';
import WardLocationSelector from './ward-location-selector.component';
import { useWardConfig } from './ward-view.resource';
import styles from './ward-view.scss';

const WardView: React.FC<{}> = () => {
  const { isLoadingLocation, isValidatingLocation, errorFetchingLocation, invalidLocation, location, mutateLocation } =
    useWardLocation();
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <PageHeader className={styles.pageHeader}>
        <PageHeaderContent illustration={<InPatientPictogram />} title={t(dashboardMeta.title, 'Hospitalization')} />
        <div className={styles.locationFilter}>
          <WardLocationSelector selectedLocation={location} />
        </div>
      </PageHeader>
      {errorFetchingLocation ? (
        <div className={styles.pageState}>
          <InlineNotification
            id="ward-location-status"
            kind="error"
            hideCloseButton
            title={t('errorLoadingWardLocation', 'Error loading ward location')}
          />
          <Button
            aria-describedby="ward-location-status"
            kind="ghost"
            size="sm"
            disabled={isValidatingLocation}
            onClick={() => void mutateLocation(undefined, { throwOnError: false })}
          >
            {t('retry', 'Retry')}
          </Button>
        </div>
      ) : isLoadingLocation ? (
        <div className={styles.pageState}>
          <InlineLoading description={t('loadingWardLocations', 'Loading ward locations...')} />
        </div>
      ) : invalidLocation ? (
        <div className={styles.pageState}>
          <InlineNotification
            kind="error"
            hideCloseButton
            title={t('invalidLocationSpecified', 'Invalid location specified')}
          />
        </div>
      ) : location ? (
        <ConfiguredWardView location={location} />
      ) : (
        <div className={styles.pageState}>
          <Tile className={styles.selectionPrompt}>
            <h2>{t('selectWardLocation', 'Select a ward')}</h2>
            <p>{t('selectWardLocationHelp', 'Select a ward to view its beds and admitted patients.')}</p>
          </Tile>
        </div>
      )}
    </div>
  );
};

const ConfiguredWardView = ({ location }: { location: Location }) => {
  const wardConfig = useWardConfig(location.uuid);

  const wardId = wardConfig.id;

  return (
    <div className={styles.wardView}>
      <ExtensionSlot name={wardId} />
    </div>
  );
};

export default WardView;
