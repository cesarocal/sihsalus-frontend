import type { FollowUpCase, FollowUpKind, FollowUpWorkspace } from '../sections/follow-up/follow-up.types';

export interface FollowUpApi {
  list(kind: FollowUpKind): Promise<FollowUpWorkspace>;
  save(record: FollowUpCase, advance?: boolean): Promise<FollowUpCase>;
  registerSample(record: FollowUpCase, personId: string): Promise<FollowUpCase>;
  close(record: FollowUpCase): Promise<FollowUpCase>;
}
/** Proposed contracts only. No deployed OMOD is assumed. */
export const followUpEndpoints = {
  cases: '/ws/rest/v1/bloodbank/follow-ups',
  tracing: '/ws/rest/v1/bloodbank/follow-ups/:id/tracing',
  samples: '/ws/rest/v1/bloodbank/follow-ups/:id/samples',
  close: '/ws/rest/v1/bloodbank/follow-ups/:id/close',
};
const unavailable = async (): Promise<never> => {
  throw new Error('FOLLOW_UP_BACKEND_NOT_IMPLEMENTED');
};
export const openmrsFollowUpApi: FollowUpApi = {
  list: unavailable,
  save: unavailable,
  registerSample: unavailable,
  close: unavailable,
};
