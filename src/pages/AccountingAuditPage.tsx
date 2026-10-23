import { useState } from 'react'
import { accountingApi } from '../api/endpoints'
import { Pagination } from '../components/Pagination'
import { ErrorBanner, Loading } from '../components/ui'
import { AUDIT_ACTION_LABELS, formatDateTime } from '../lib/format'
import { useLoad } from '../lib/useLoad'

const PAGE_SIZE = 20

/** What was done in the accounting module, most recent first (administrator only). */
export function AccountingAuditPage() {
  const [page, setPage] = useState(0)
  const audit = useLoad(() => accountingApi.audit(page, PAGE_SIZE), [page])
  const result = audit.data

  return (
    <>
      <ErrorBanner message={audit.error} onRetry={audit.reload} />
      {audit.loading && !result && <Loading />}
      {result && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((entry, index) => (
                  <tr key={`${entry.occurredAt}-${index}`}>
                    <td>{formatDateTime(entry.occurredAt)}</td>
                    <td>{entry.userName}</td>
                    <td>{AUDIT_ACTION_LABELS[entry.action]}</td>
                    <td className="muted small">{entry.details}</td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted empty-row">
                      Nada registrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={result.totalPages} totalItems={result.totalItems} noun="registros" onPage={setPage} />
        </div>
      )}
    </>
  )
}
