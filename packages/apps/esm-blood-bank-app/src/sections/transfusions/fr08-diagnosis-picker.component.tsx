import { Button, Search, TextInput } from '@carbon/react';
import { useDebounce } from '@openmrs/esm-framework';
import { useEffect, useState } from 'react';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { type DiagnosisOption, searchFr08Diagnoses } from './fr08-catalogs.resource';
import styles from './transfusions.scss';

export function Fr08DiagnosisPicker({
  id,
  selected,
  onChange,
  t,
}: {
  id: string;
  selected?: DiagnosisOption;
  onChange: (diagnosis?: DiagnosisOption) => void;
  t: ProcessingTranslate;
}) {
  const [query, setQuery] = useState('');
  const normalized = query.trim();
  const debounced = useDebounce(normalized);
  const [search, setSearch] = useState<{ query: string; results?: DiagnosisOption[] }>();

  useEffect(() => {
    if (selected || normalized.length < 3 || normalized !== debounced) return;
    const controller = new AbortController();
    const finish = (results?: DiagnosisOption[]) => {
      if (!controller.signal.aborted) setSearch({ query: normalized, results });
    };
    void searchFr08Diagnoses(normalized, controller.signal).then(finish, () => finish());
    return () => controller.abort();
  }, [debounced, normalized, selected]);

  const display = (item: DiagnosisOption) => (item.code ? `${item.code} · ${item.name}` : item.name);
  if (selected)
    return (
      <div className={styles.fr08Diagnosis}>
        <TextInput id={id} labelText={t('fr08Diagnosis')} value={display(selected)} readOnly />
        <Button kind="ghost" type="button" size="sm" onClick={() => onChange()}>
          {t('fr08ChangeDiagnosis')}
        </Button>
      </div>
    );

  const active = search?.query === normalized ? search : undefined;
  return (
    <div className={styles.fr08DiagnosisSearch}>
      <label className="cds--label" htmlFor={id} id={`${id}-label`}>
        {t('fr08Diagnosis')}
      </label>
      <Search
        id={id}
        size="md"
        labelText={t('fr08Diagnosis')}
        aria-labelledby={`${id}-label`}
        placeholder={t('fr08SearchDiagnosis')}
        closeButtonLabelText={t('clearSearch')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (event.target.value.trim() !== normalized) setSearch(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault();
        }}
      />
      {normalized.length >= 3 && !active?.results?.length && (
        <p role="status">
          {t(!active ? 'fr08SearchingDiagnoses' : active.results ? 'fr08NoDiagnoses' : 'fr08DiagnosisSearchFailed')}
        </p>
      )}
      {active?.results && active.results.length > 0 && (
        <ul aria-label={t('fr08DiagnosisResults')}>
          {active.results.map((item) => (
            <li key={item.uuid}>
              <Button
                type="button"
                kind="ghost"
                size="sm"
                onMouseDown={(event) => {
                  // Keep the search focused while selecting a result inside the scrolling modal.
                  event.preventDefault();
                }}
                onClick={() => {
                  onChange(item);
                  setQuery('');
                  setSearch(undefined);
                }}
              >
                {display(item)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
