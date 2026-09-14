import { Button, Dropdown, InlineLoading, InlineNotification } from '@carbon/react';
import { type Location } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useWardLocations from '../hooks/useWardLocations';

export default function WardLocationSelector({ selectedLocation }: { selectedLocation?: Location }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: admissionLocations, error, isLoading, isValidating, mutate } = useWardLocations();

  if (error || (!isLoading && !admissionLocations?.length)) {
    return (
      <div>
        <InlineNotification
          id="ward-catalog-status"
          kind={error ? 'error' : 'info'}
          hideCloseButton
          lowContrast
          title={
            error
              ? t('errorLoadingWardLocations', 'Could not load the list of wards.')
              : t('noWardLocations', 'No wards are available.')
          }
        />
        <Button
          aria-describedby="ward-catalog-status"
          kind="ghost"
          size="sm"
          disabled={isValidating}
          onClick={() => void mutate(undefined, { throwOnError: false })}
        >
          {t('retry', 'Retry')}
        </Button>
      </div>
    );
  }

  if (isLoading || !admissionLocations) {
    return <InlineLoading description={t('loadingWardLocations', 'Loading ward locations...')} />;
  }

  return (
    <Dropdown
      id="ward-location-selector"
      items={admissionLocations}
      itemToString={(location) => location?.display ?? location?.name ?? ''}
      label={t('selectWardLocation', 'Select a ward')}
      titleText={t('wardLocation', 'Ward location')}
      selectedItem={admissionLocations.find((location) => location.uuid === selectedLocation?.uuid) ?? null}
      onChange={({ selectedItem }) => {
        if (selectedItem?.uuid) {
          navigate(`/${encodeURIComponent(selectedItem.uuid)}`);
        }
      }}
    />
  );
}
