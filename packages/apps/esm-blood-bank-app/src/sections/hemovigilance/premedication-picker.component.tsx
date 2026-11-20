import { Button, Search, TextInput } from '@carbon/react';
import { useDebounce } from '@openmrs/esm-framework';
import { useEffect, useId, useState } from 'react';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { searchPremedications } from './hemovigilance.resource';
import styles from './hemovigilance.scss';

export function PremedicationPicker({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (uuid: string, name: string) => void;
  t: ProcessingTranslate;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const term = query.trim();
  const debounced = useDebounce(term);
  const [search, setSearch] = useState<{ term: string; options?: Awaited<ReturnType<typeof searchPremedications>> }>();
  useEffect(() => {
    if (value || term.length < 3 || term !== debounced) return;
    const controller = new AbortController();
    const finish = (options?: Awaited<ReturnType<typeof searchPremedications>>) => {
      if (!controller.signal.aborted) setSearch({ term, options });
    };
    void searchPremedications(term, controller.signal).then(finish, () => finish());
    return () => controller.abort();
  }, [debounced, term, value]);

  if (value)
    return (
      <div className={styles.premedicationSelected}>
        <TextInput id={id} value={value} labelText={t('premedication')} readOnly />
        <Button type="button" kind="ghost" size="sm" onClick={() => onChange('', '')}>
          {t('clearPremedication')}
        </Button>
      </div>
    );

  const active = search?.term === term ? search : undefined;
  return (
    <div className={styles.premedicationPicker}>
      <label className="cds--label" htmlFor={id} id={`${id}-label`}>
        {t('premedication')}
      </label>
      <Search
        id={id}
        size="md"
        labelText={t('premedication')}
        aria-labelledby={`${id}-label`}
        placeholder={t('searchPremedication')}
        closeButtonLabelText={t('clearSearch')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (term !== event.target.value.trim()) setSearch(undefined);
        }}
      />
      {term.length >= 3 && !active?.options?.length && (
        <p role="status">
          {t(
            !active
              ? 'searchingPremedication'
              : active.options
                ? 'noPremedicationResults'
                : 'premedicationSearchFailed',
          )}
        </p>
      )}
      {!!active?.options?.length && (
        <ul aria-label={t('premedicationResults')}>
          {active.options.map(({ uuid, display }) => (
            <li key={uuid}>
              <Button
                type="button"
                kind="ghost"
                size="sm"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(uuid, display);
                  setQuery('');
                  setSearch(undefined);
                }}
              >
                {display}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
