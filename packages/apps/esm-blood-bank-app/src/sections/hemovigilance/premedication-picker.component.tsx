import { Button, Search } from '@carbon/react';
import { Close } from '@carbon/react/icons';
import { useDebounce } from '@openmrs/esm-framework';
import { useEffect, useId, useState } from 'react';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { searchPremedications } from './hemovigilance.resource';
import styles from './hemovigilance.scss';

export function PremedicationPicker({
  selected,
  onChange,
  readOnly,
  t,
}: {
  selected: { uuid: string; name: string }[];
  onChange: (uuid: string, name?: string) => void;
  readOnly: boolean;
  t: ProcessingTranslate;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const term = query.trim();
  const debounced = useDebounce(term);
  const [search, setSearch] = useState<{ term: string; options?: Awaited<ReturnType<typeof searchPremedications>> }>();
  useEffect(() => {
    if (readOnly || term.length < 3 || term !== debounced) return;
    const controller = new AbortController();
    const finish = (options?: Awaited<ReturnType<typeof searchPremedications>>) => {
      if (!controller.signal.aborted) setSearch({ term, options });
    };
    void searchPremedications(term, controller.signal).then(finish, () => finish());
    return () => controller.abort();
  }, [debounced, term, readOnly]);

  const selections = selected.length ? (
    <ul className={styles.premedicationSelected} aria-label={t('premedication')}>
      {selected.map(({ uuid, name }) => (
        <li key={uuid}>
          <span>{name}</span>
          {!readOnly && (
            <Button
              type="button"
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={Close}
              iconDescription={t('removePremedication', { name })}
              onClick={() => onChange(uuid)}
            />
          )}
        </li>
      ))}
    </ul>
  ) : null;
  if (readOnly)
    return (
      <div>
        <span className="cds--label">{t('premedication')}</span>
        {selections ?? <div>—</div>}
      </div>
    );

  const active = search?.term === term ? search : undefined;
  const available = active?.options?.filter(({ uuid }) => !selected.some((item) => item.uuid === uuid));
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
      {selections}
      {term.length >= 3 && !available?.length && (
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
      {!!available?.length && (
        <ul className={styles.premedicationResults} aria-label={t('premedicationResults')}>
          {available.map(({ uuid, display }) => (
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
