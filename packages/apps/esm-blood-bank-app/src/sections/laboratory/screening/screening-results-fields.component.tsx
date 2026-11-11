import {
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from '@carbon/react';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import styles from '../../applicant-selection/selection.scss';
import {
  screeningBloodGroups,
  screeningResultOptions,
  screeningRhFactors,
  screeningSpecialties,
  screeningTableTests,
  type ScreeningRecord,
  type ScreeningResult,
} from './screening.types';
import screeningStyles from './screening.scss';

export function ScreeningOutcomeField({
  name,
  label,
  value,
  readOnly = false,
  disabled,
  invalid,
  onChange,
  t,
}: {
  name: string;
  label: string;
  value: ScreeningResult;
  readOnly?: boolean;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: ScreeningResult) => void;
  t: ProcessingTranslate;
}) {
  if (readOnly) return <TextInput id={name} labelText={label} hideLabel value={value ? t(value) : '—'} readOnly />;
  return (
    <RadioButtonGroup
      name={name}
      aria-label={label}
      valueSelected={value}
      disabled={disabled}
      invalid={invalid}
      invalidText={t('requiredFields')}
      onChange={(result) => onChange(result as ScreeningResult)}
    >
      {screeningResultOptions.map((result) => (
        <RadioButton key={result} id={`${name}-${result}`} value={result} labelText={t(result)} />
      ))}
    </RadioButtonGroup>
  );
}

export function ScreeningResultsFields({
  record,
  readOnly,
  saving,
  errors,
  onChange,
  t,
}: {
  record: ScreeningRecord;
  readOnly: boolean;
  saving: boolean;
  errors: string[];
  onChange: (record: ScreeningRecord) => void;
  t: ProcessingTranslate;
}) {
  const bloodData = record.bloodData ?? { aboGroup: '', rhFactor: '', hematocrit: '', hemoglobin: '' };
  const additional = record.additionalTest ?? { name: '', result: '' };
  const recommendations = record.recommendations ?? { gastroenterology: '', infectiousDiseases: '', procets: '' };
  const resultField = (
    name: string,
    label: string,
    value: ScreeningResult,
    errorKey: string,
    select: (value: ScreeningResult) => void,
  ) => (
    <ScreeningOutcomeField
      name={name}
      label={label}
      value={value}
      readOnly={readOnly}
      disabled={saving}
      invalid={errors.includes(errorKey)}
      onChange={select}
      t={t}
    />
  );
  return (
    <>
      <section className={styles.questionGroup}>
        <h3>{t('screeningBloodData')}</h3>
        <div className={styles.fields}>
          {(['aboGroup', 'rhFactor'] as const).map((field) =>
            readOnly ? (
              <TextInput key={field} id={`screening-${field}`} labelText={t(field)} value={bloodData[field]} readOnly />
            ) : (
              <Select
                key={field}
                id={`screening-${field}`}
                labelText={t(field)}
                value={bloodData[field]}
                disabled={saving}
                invalid={errors.includes(field)}
                invalidText={t('requiredFields')}
                onChange={({ target: { value } }) =>
                  onChange({ ...record, bloodData: { ...bloodData, [field]: value } })
                }
              >
                <SelectItem value="" text={t('choose')} />
                {(field === 'aboGroup' ? screeningBloodGroups : screeningRhFactors).map((value) => (
                  <SelectItem key={value} value={value} text={value} />
                ))}
              </Select>
            ),
          )}
          {(['hematocrit', 'hemoglobin'] as const).map((field) => (
            <TextInput
              key={field}
              id={`screening-${field}`}
              labelText={t(field)}
              inputMode="decimal"
              value={bloodData[field]}
              readOnly={readOnly}
              disabled={saving && !readOnly}
              invalid={errors.includes(field)}
              invalidText={t('screeningInvalidMeasurement')}
              onChange={({ target: { value } }) => onChange({ ...record, bloodData: { ...bloodData, [field]: value } })}
            />
          ))}
        </div>
      </section>
      <Table className={screeningStyles.resultsTable} aria-label={t('results')}>
        <TableHead>
          <TableRow>
            <TableHeader scope="col">{t('screeningTestPerformed')}</TableHeader>
            <TableHeader scope="col">{t('result')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {screeningTableTests.map((test) => {
            const label = `screeningTest_${test}`;
            return (
              <TableRow key={test}>
                <th scope="row">{t(label)}</th>
                <TableCell>
                  {resultField(`screening-${test}`, t(label), record.tests[test]?.result ?? '', label, (result) =>
                    onChange({ ...record, tests: { ...record.tests, [test]: { ...record.tests[test], result } } }),
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {(!readOnly || additional.name) && (
            <TableRow>
              <TableCell>
                <TextInput
                  id="screening-additional-test"
                  labelText={t('screeningAdditionalTest')}
                  value={additional.name}
                  readOnly={readOnly}
                  disabled={saving && !readOnly}
                  invalid={errors.includes('screeningAdditionalTest')}
                  invalidText={t('requiredFields')}
                  onChange={({ target: { value } }) =>
                    onChange({
                      ...record,
                      additionalTest: { name: value, result: value.trim() ? additional.result : '' },
                    })
                  }
                />
              </TableCell>
              <TableCell>
                {resultField(
                  'screening-additional-result',
                  t('screeningAdditionalResult'),
                  additional.result,
                  'screeningAdditionalResult',
                  (result) => onChange({ ...record, additionalTest: { ...additional, result } }),
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <section className={styles.questionGroup}>
        <h3>{t('screeningRecommendations')}</h3>
        <div className={styles.fields}>
          {screeningSpecialties.map((specialty) =>
            readOnly ? (
              <TextInput
                key={specialty}
                id={`screening-${specialty}`}
                labelText={t(specialty)}
                value={recommendations[specialty] ? t(recommendations[specialty]) : '—'}
                readOnly
              />
            ) : (
              <RadioButtonGroup
                key={specialty}
                name={`screening-${specialty}`}
                legendText={t(specialty)}
                valueSelected={recommendations[specialty]}
                disabled={saving}
                invalid={errors.includes(specialty)}
                invalidText={t('requiredFields')}
                onChange={(value) =>
                  onChange({ ...record, recommendations: { ...recommendations, [specialty]: value as 'yes' | 'no' } })
                }
              >
                {(['yes', 'no'] as const).map((value) => (
                  <RadioButton key={value} id={`screening-${specialty}-${value}`} value={value} labelText={t(value)} />
                ))}
              </RadioButtonGroup>
            ),
          )}
        </div>
      </section>
    </>
  );
}
