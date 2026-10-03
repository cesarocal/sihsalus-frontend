import { Button, Search, Select, SelectItem, Tag } from '@carbon/react';
import { List } from '@carbon/react/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BloodBankApi } from '../../api';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
  useProcessingTranslation,
} from '../../shared/processing-page.component';
import { donorDetailPath } from '../../constants';
import { DonorRegistry } from './donor-registry.component';
import { donorStatusKey, formatDonorDate } from './donor-utils';
import styles from '../applicant-selection/selection.scss';

export function DonorsPage({ api }: { api: BloodBankApi }) {
  const t = useProcessingTranslation();
  const navigate = useNavigate();
  const { data, loading, failed, reload } = useProcessingData(api.getDonors);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [registryOpen, setRegistryOpen] = useState(false);
  const donors = data ?? [];
  const filtered = donors.filter(
    (donor) =>
      (!status || donor.status === status) &&
      (!bloodGroup || donor.bloodGroup === bloodGroup) &&
      normalizeSearch(`${donor.id} ${donor.documentNumber} ${donor.fullName}`).includes(normalizeSearch(search.trim())),
  );
  return (
    <ProcessingPage
      title={t('donorsTitle')}
      illustration="donors"
      counts={[
        { label: t('registeredDonors'), description: t('peopleUnit'), value: loading || failed ? '—' : donors.length },
        ...(['Apto', 'Diferido'] as const).map((value) => ({
          label: t(value === 'Apto' ? 'eligibleDonors' : 'deferredDonors'),
          description: t('donorsUnit'),
          value: loading || failed ? '—' : donors.filter((donor) => donor.status === value).length,
        })),
      ]}
    >
      {registryOpen ? (
        <DonorRegistry api={api} onBack={() => setRegistryOpen(false)} />
      ) : (
        <>
          <div className={styles.listHeading}>
            <h2>{t('donorList')}</h2>
          </div>
          <div className={styles.surface}>
            <div className={styles.filters}>
              <Select
                id="donor-status"
                labelText={t('status')}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <SelectItem value="" text={t('allStatuses')} />
                {Object.entries(donorStatusKey).map(([value, key]) => (
                  <SelectItem key={value} value={value} text={t(key)} />
                ))}
              </Select>
              <Select
                id="donor-group"
                labelText={t('bloodGroup')}
                value={bloodGroup}
                onChange={(event) => setBloodGroup(event.target.value)}
              >
                <SelectItem value="" text={t('allBloodGroups')} />
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((value) => (
                  <SelectItem key={value} value={value} text={value} />
                ))}
              </Select>
              <div className={styles.searchActions}>
                <Search
                  id="donor-search"
                  labelText={t('searchDonors')}
                  placeholder={t('donorSearchPlaceholder')}
                  value={search}
                  closeButtonLabelText={t('clearSearch')}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Button renderIcon={List} onClick={() => setRegistryOpen(true)}>
                  {t('donorRegistry')}
                </Button>
              </div>
            </div>
            <ProcessingTable
              title={t('donorList')}
              columns={['donorCode', 'document', 'donorName', 'bloodGroup', 'lastDonation', 'status', 'actions']}
              rows={filtered.map((donor) => ({
                id: donor.id,
                cells: [
                  donor.id,
                  donor.documentNumber,
                  donor.fullName,
                  donor.bloodGroup,
                  formatDonorDate(donor.lastDonationDate),
                  <Tag
                    key="status"
                    type={donor.status === 'Apto' ? 'green' : donor.status === 'Diferido' ? 'magenta' : 'blue'}
                  >
                    {t(donorStatusKey[donor.status])}
                  </Tag>,
                  <Button key="detail" kind="ghost" size="sm" onClick={() => void navigate(donorDetailPath(donor.id))}>
                    {t('viewDonorDetail')}
                  </Button>,
                ],
              }))}
              loading={loading}
              failed={failed}
              reload={reload}
              emptyHelp={t('emptyDonors')}
              t={t}
            />
          </div>
        </>
      )}
    </ProcessingPage>
  );
}
