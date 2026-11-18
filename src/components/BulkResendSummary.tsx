import { summarizeResendResults } from '@/lib/invitation-resend'
import type { DisplayResendResult } from '@/hooks/useInvitationResend'

export default function BulkResendSummary({ results, busy = false }: { results: DisplayResendResult[] | null; busy?: boolean }) {
  if (!results) return null
  const summary = summarizeResendResults(results)
  const issues = results.filter((result) => result.status !== 'SENT')
  return <div className="bulk-resend-summary" role="status" aria-live="polite">
    <p>{busy ? 'Sending invitations:' : 'Resend complete:'} {summary.sent} sent, {summary.skipped} skipped, {summary.failed} failed.</p>
    {issues.length > 0 && <details><summary>View skipped and failed invitations</summary><ul>{issues.map((result) => <li key={result.id}>{result.email ? `${result.email}: ` : ''}{result.message}</li>)}</ul></details>}
  </div>
}
