import { InlineLoading, Layer, Tile } from '@carbon/react';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PatientSearchResponse } from '../types';
import EmptyDataIllustration from '../ui-components/empty-data-illustration.component';

import CompactPatientBanner from './compact-patient-banner.component';
import Loader from './loader.component';
import styles from './patient-search.scss';

interface RecentPatientResultsProps
  extends Pick<PatientSearchResponse, 'data' | 'fetchError' | 'isLoading' | 'isValidating'> {
  standalone?: boolean;
}

export const RecentPatientResults = React.forwardRef<HTMLDivElement, RecentPatientResultsProps>(
  ({ data: patients, fetchError, isLoading, isValidating, standalone = false }, ref) => {
    const { t } = useTranslation();
    const resultsClassName = classNames(styles.searchResults, { [styles.standaloneResults]: standalone });

    if (!patients && isLoading) {
      return (
        <div className={styles.searchResultsContainer} role="progressbar">
          {[...Array(5)].map((_, index) => (
            <Loader key={index} />
          ))}
        </div>
      );
    }

    if (fetchError) {
      return (
        <div className={resultsClassName}>
          <Layer>
            <Tile className={styles.emptySearchResultsTile}>
              <EmptyDataIllustration />
              <div>
                <p className={styles.errorMessage}>{t('error', 'Error')}</p>
                <p className={styles.errorCopy}>
                  {t('errorCopy', 'Sorry, there was an error. Please try again or contact the site administrator.')}
                </p>
              </div>
            </Tile>
          </Layer>
        </div>
      );
    }

    if (patients?.length) {
      return (
        <div className={styles.searchResultsContainer}>
          <div className={resultsClassName}>
            <div className={styles.resultsText}>
              <span className={styles.resultsTextCount}>
                {t('recentlyViewedPatientsCount', '{{count}} recently viewed patient', {
                  count: patients.length,
                })}
              </span>
              {isValidating && (
                <span className={styles.validationIcon}>
                  <InlineLoading className={styles.spinner} />
                </span>
              )}
            </div>
            <CompactPatientBanner patients={patients} ref={ref} />
          </div>
        </div>
      );
    }

    if (!patients?.length) {
      return (
        <div className={styles.searchResultsContainer}>
          <div className={resultsClassName}>
            <Layer>
              <Tile className={styles.emptySearchResultsTile}>
                <EmptyDataIllustration />
                <p className={styles.emptyResultText}>
                  {t('noRecentlyViewedPatients', 'No recently viewed patient charts are available in this session.')}
                </p>
                <p className={styles.actionText}>
                  <span>
                    {t(
                      'recentlyViewedPatientsEmptyHelp',
                      'Open a patient chart from search, a queue, a visit or a direct link to see it here.',
                    )}
                  </span>
                </p>
              </Tile>
            </Layer>
          </div>
        </div>
      );
    }
  },
);

const RecentPatientsPreview = React.forwardRef<HTMLDivElement, RecentPatientResultsProps>((props, ref) => {
  const { t } = useTranslation();
  return (
    <section aria-label={t('recentlyViewedPatients', 'Recently viewed patients')}>
      <RecentPatientResults {...props} ref={ref} />
    </section>
  );
});

export default RecentPatientsPreview;
