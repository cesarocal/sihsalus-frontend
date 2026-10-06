import { Button, Tag } from '@carbon/react';
import { Fork } from '@carbon/react/icons';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { componentDefinitions, separationOptions } from './fractionation-rules';
import type { ComponentType, FractionationBatch, FractionationNode } from './fractionation.types';
import styles from './fractionation.scss';

/** Code-native pictogram: illustrative fill only; text carries component identity, not color alone. */
export function ComponentBag({ component }: { component: ComponentType }) {
  const { color, fill } = componentDefinitions[component];
  return (
    <svg viewBox="0 0 56 80" width="48" height="68" aria-hidden="true" focusable="false">
      <path
        d="M20 10V5h16v5M16 14h24c5 0 8 4 8 9v39c0 5-4 8-8 8H16c-5 0-8-3-8-8V23c0-5 3-9 8-9ZM20 70v5m16-5v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="12" y={65 - 45 * fill} width="32" height={45 * fill} rx="3" fill={color} opacity="0.85" />
      <rect x="19" y="28" width="18" height="14" rx="1" fill="white" stroke="currentColor" />
      <path d="M22 32h12m-12 4h8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function FractionationTree({
  batch,
  onSplit,
  disabled = false,
  t,
}: {
  batch: FractionationBatch;
  onSplit?: (id: string, option: number | null) => void;
  disabled?: boolean;
  t: ProcessingTranslate;
}) {
  const renderNode = (node: FractionationNode) => {
    const children = batch.nodes.filter((item) => item.parentId === node.id);
    const options = separationOptions[node.component];
    return (
      <li key={node.id}>
        <div className={styles.node}>
          <ComponentBag component={node.component} />
          <div className={styles.nodeIdentity}>
            <strong>{t(componentDefinitions[node.component].key)}</strong>
            <p>{node.code}</p>
            {node.parentId && (
              <Tag type={children.length ? 'gray' : 'teal'}>
                {t(children.length ? 'fractionationIntermediate' : 'fractionationFinalComponent')}
              </Tag>
            )}
            {!onSplit && !children.length && <p>{node.volume || node.estimatedVolume || '—'} mL</p>}
          </div>
          {onSplit && options && (
            <div className={styles.nodeActions}>
              {options.map((_option, index) => (
                <Button
                  key={index === 0 ? 'primary' : 'alternative'}
                  size="sm"
                  kind="tertiary"
                  renderIcon={Fork}
                  disabled={disabled || children.length > 0}
                  onClick={() => onSplit(node.id, index)}
                  aria-label={`${t(node.component === 'plateletRichPlasma' ? (index === 0 ? 'fractionationUsePFC' : 'fractionationUsePlasma24') : 'fractionationSplit')} — ${node.code}`}
                >
                  {t(
                    node.component === 'plateletRichPlasma'
                      ? index === 0
                        ? 'fractionationUsePFC'
                        : 'fractionationUsePlasma24'
                      : 'fractionationSplit',
                  )}
                </Button>
              ))}
              {!!children.length && (
                <Button kind="ghost" size="sm" disabled={disabled} onClick={() => onSplit(node.id, null)}>
                  {t('fractionationClearBranch')}
                </Button>
              )}
            </div>
          )}
        </div>
        {!!children.length && <ul>{children.map(renderNode)}</ul>}
      </li>
    );
  };
  return (
    <div className={styles.forest}>
      {batch.sources.map((source) => (
        <section className={styles.source} key={source.id} aria-label={source.code}>
          <h4>
            {t('fractionationSource')}: {source.code}
          </h4>
          <p className={styles.help}>
            {t('fractionationOrigin')}: {source.originalWholeBloodCode} · {source.volume} mL ·{' '}
            {source.label.bloodGroup || '—'}
          </p>
          <ul className={styles.tree}>
            {batch.nodes.filter((node) => node.sourceId === source.id && node.parentId === null).map(renderNode)}
          </ul>
        </section>
      ))}
    </div>
  );
}
