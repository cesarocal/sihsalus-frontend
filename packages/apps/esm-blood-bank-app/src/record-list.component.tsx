import { Tag, Tile } from '@carbon/react';

import type { PrototypeRecord } from './types';
import styles from './root.scss';

interface RecordListProps {
  records: PrototypeRecord[];
  emptyLabel: string;
}

export function RecordList({ records, emptyLabel }: RecordListProps) {
  if (!records.length) {
    return <p className={styles.muted}>{emptyLabel}</p>;
  }

  return (
    <div className={styles.recordList}>
      {records.map((record) => (
        <Tile className={styles.record} key={record.id}>
          <div>
            <span className={styles.recordId}>{record.id}</span>
            <h3>{record.primary}</h3>
            <p>{record.secondary}</p>
            <small>{record.tertiary}</small>
          </div>
          <Tag size="sm" type={record.tone}>
            {record.status}
          </Tag>
        </Tile>
      ))}
    </div>
  );
}
