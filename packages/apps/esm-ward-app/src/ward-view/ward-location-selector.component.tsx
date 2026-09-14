import { Dropdown, InlineLoading } from '@carbon/react';
import { type Location, useLocations } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function WardLocationSelector({ selectedLocation }: { selectedLocation?: Location }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const admissionLocations = useLocations('Admission Location');

  if (!admissionLocations.length) {
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
          navigate(`/${selectedItem.uuid}`);
        }
      }}
    />
  );
}
