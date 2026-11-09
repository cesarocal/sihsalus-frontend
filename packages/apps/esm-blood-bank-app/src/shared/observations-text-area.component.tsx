import { TextArea } from '@carbon/react';
import type { ComponentProps } from 'react';
import { countUtf16Units, observationsExceedLimit, observationsTextContract } from './text-field-contracts';

type ObservationsTextAreaProps = Pick<
  ComponentProps<typeof TextArea>,
  'id' | 'labelText' | 'rows' | 'readOnly' | 'disabled' | 'onChange'
> & {
  value: string;
  t: (key: string) => string;
};

export function ObservationsTextArea({ value, t, ...props }: ObservationsTextAreaProps) {
  const overflow = !props.readOnly && observationsExceedLimit(value);
  const counter = `${countUtf16Units(value)} / ${observationsTextContract.maxUtf16Units}`;
  return (
    <TextArea
      {...props}
      value={value}
      helperText={props.readOnly ? undefined : `${counter} ${t('observationCharacters')}`}
      invalid={overflow}
      invalidText={
        overflow ? (
          <span aria-live="polite">
            {t('observationsTooLong')} {counter}
          </span>
        ) : undefined
      }
    />
  );
}
