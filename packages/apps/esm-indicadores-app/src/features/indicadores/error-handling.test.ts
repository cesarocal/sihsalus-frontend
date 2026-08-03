import { describe, expect, it } from 'vitest';

import { indicatorsErrorMessageOptions } from './error-handling';

describe('indicatorsErrorMessageOptions', () => {
  it('uses the active locale for HTTP status messages', () => {
    const englishMessages: Record<string, string> = {
      indicatorsError400: 'The submitted data is invalid.',
      indicatorsError401: 'Your session expired.',
      indicatorsError403: 'You do not have permission.',
      indicatorsError404: 'The requested record no longer exists.',
      indicatorsError409: 'The record was modified.',
      indicatorsError422: 'The submitted data is not valid for the indicator.',
      indicatorsError500: 'The indicators service encountered an error.',
      indicatorsError502: 'The indicators service is unavailable.',
      indicatorsError503: 'The indicators service is unavailable.',
      indicatorsError504: 'The indicators service timed out.',
    };
    const t = (key: string, defaultValue: string) => englishMessages[key] ?? defaultValue;

    const options = indicatorsErrorMessageOptions(t);

    expect(options.statusMessages).toEqual({
      400: englishMessages.indicatorsError400,
      401: englishMessages.indicatorsError401,
      403: englishMessages.indicatorsError403,
      404: englishMessages.indicatorsError404,
      409: englishMessages.indicatorsError409,
      422: englishMessages.indicatorsError422,
      500: englishMessages.indicatorsError500,
      502: englishMessages.indicatorsError502,
      503: englishMessages.indicatorsError503,
      504: englishMessages.indicatorsError504,
    });
  });
});
