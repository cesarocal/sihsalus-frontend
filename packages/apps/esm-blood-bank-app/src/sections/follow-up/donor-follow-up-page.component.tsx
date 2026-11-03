import type { FollowUpApi } from '../../api/follow-up.api';
import { FollowUpPage } from './follow-up-page.component';

export function DonorFollowUpPage({ api }: { api: FollowUpApi }) {
  return <FollowUpPage kind="donor" api={api} />;
}
