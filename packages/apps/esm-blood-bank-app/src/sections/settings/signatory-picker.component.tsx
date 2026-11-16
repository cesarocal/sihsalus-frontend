import { Button, Search } from '@carbon/react';
import { useDebounce } from '@openmrs/esm-framework';
import { useEffect, useRef, useState } from 'react';
import {
  type DisposalSignatoryPerson,
  getDisposalSignatoryName,
  searchDisposalSignatories,
} from '../../api/inventory.api';
import { useProcessingTranslation } from '../../shared/processing-page.component';
import styles from './settings.scss';

const minimumQueryLength = 3;

export function SignatoryPicker({
  label,
  personUuid,
  editable,
  saving,
  onChange,
}: {
  label: string;
  personUuid: string;
  editable: boolean;
  saving: boolean;
  onChange: (uuid: string) => void;
}) {
  const t = useProcessingTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState<DisposalSignatoryPerson>();
  const [search, setSearch] = useState<{ query: string; results: DisposalSignatoryPerson[] | null }>();
  const current = resolved?.uuid === personUuid ? resolved : undefined;
  const unresolvedUuid = current ? '' : personUuid;
  const nameQuery = query.trim().replace(/\s+/g, ' ');
  const debouncedQuery = useDebounce(nameQuery);

  useEffect(() => {
    if (!unresolvedUuid) return;
    let active = true;
    const finish = (name: string) => {
      if (active) setResolved({ uuid: unresolvedUuid, name });
    };
    void getDisposalSignatoryName(unresolvedUuid).then(finish, () => finish(''));
    return () => {
      active = false;
    };
  }, [unresolvedUuid]);

  useEffect(() => {
    if (!editable || nameQuery.length < minimumQueryLength || nameQuery !== debouncedQuery) return;
    const controller = new AbortController();
    const finish = (results: DisposalSignatoryPerson[] | null) => {
      if (!controller.signal.aborted) setSearch({ query: nameQuery, results });
    };
    void searchDisposalSignatories(nameQuery, controller.signal).then(finish, () => finish(null));
    return () => controller.abort();
  }, [editable, nameQuery, debouncedQuery]);

  const activeSearch = search?.query === nameQuery ? search : undefined;
  const results = editable && nameQuery.length >= minimumQueryLength ? activeSearch?.results : undefined;
  const searchStatus = () => {
    if (!editable || !nameQuery) return '';
    if (nameQuery.length < minimumQueryLength) return t('settingsSignatorySearchHelp');
    if (!activeSearch) return t('settingsSignatorySearching');
    if (!results) return t('settingsSignatorySearchError');
    return results.length ? '' : t('settingsSignatoryNoResults');
  };

  return (
    <fieldset className={styles.signatory}>
      <legend>{label}</legend>
      {personUuid && (
        <div className={styles.selectedPerson}>
          <span role="status">
            {current ? current.name || t('settingsSignatoryNameError') : t('settingsSignatoryLoading')}
          </span>
          {editable && (
            <Button
              type="button"
              kind="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                onChange('');
                input.current?.focus();
              }}
            >
              {t('settingsRemoveSignatory')}
            </Button>
          )}
        </div>
      )}
      {editable ? (
        <Search
          ref={input}
          size="md"
          labelText={t('settingsSignatorySearch')}
          placeholder={t('settingsSignatorySearch')}
          closeButtonLabelText={t('clearSearch')}
          value={query}
          disabled={saving}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
          onChange={(event) => {
            const text = event.target.value;
            setQuery(text);
            if (text.trim().replace(/\s+/g, ' ') !== nameQuery) setSearch(undefined);
          }}
        />
      ) : (
        !personUuid && <p>{t('settingsSignatoryUnassigned')}</p>
      )}
      <p className={styles.searchStatus} role="status">
        {searchStatus()}
      </p>
      {!!results?.length && (
        <ul className={styles.searchResults} aria-label={t('settingsSignatoryResults')}>
          {results.map((person) => (
            <li key={person.uuid}>
              <Button
                type="button"
                kind="ghost"
                size="sm"
                className={styles.resultButton}
                disabled={saving}
                onClick={() => {
                  setResolved(person);
                  onChange(person.uuid);
                  setQuery('');
                  setSearch(undefined);
                  input.current?.focus();
                }}
              >
                {person.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
