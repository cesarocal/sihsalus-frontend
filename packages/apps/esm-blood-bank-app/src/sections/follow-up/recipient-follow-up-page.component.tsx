import type { FollowUpApi } from '../../api/follow-up.api';
import { FollowUpPage } from './follow-up-page.component';

export function RecipientFollowUpPage({ api }: { api: FollowUpApi }) {
  return <FollowUpPage kind="recipient" api={api} />;
}
