import { useState } from 'react'
import { errorMessage } from '../api/client'
import { accountingApi } from '../api/endpoints'
import type { RegistryBase, RegistryImportSummary } from '../api/types'
import { Pagination } from '../components/Pagination'
import { ErrorBanner, Loading } from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useLoad } from '../lib/useLoad'

const PAGE_SIZE = 20

const BASE_LABELS: Record<RegistryBase, string> = { CHART_ACCOUNT: 'Depara', SUPPLIER: 'Fornecedores' }

/** Bulk load and backup of the Depara and Fornecedores, and the conflicts those loads left for review. */
export function RegistriesPage() {
  const [conflictsVersion, setConflictsVersion] = useState(0)
  return (
    <>
      <div className="registry-cards">
        <RegistryCard
          title="Depara (plano de contas)"
          columns="Código; Conta Contábil; Descrição; Grau; Tipo; Resultado; e uma coluna por empresa, com o nome curto dela no cabeçalho"
          onImport={accountingApi.importChartAccounts}
          onExport={accountingApi.exportChartAccounts}
          onImported={() => setConflictsVersion((v) => v + 1)}
        />
        <RegistryCard
          title="Fornecedores"
          columns="Código da Empresa; Nome; CNPJ; e uma coluna &quot;Conta Contábil&quot; seguida do nome curto de cada empresa"
          onImport={accountingApi.importSuppliers}
          onExport={accountingApi.exportSuppliers}
          onImported={() => setConflictsVersion((v) => v + 1)}
        />
      </div>
      <Conflicts version={conflictsVersion} />
    </>
  )
}

interface RegistryCardProps {
  title: string
  columns: string
  onImport: (file: File) => Promise<RegistryImportSummary>
  onExport: () => Promise<void>
  onImported: () => void
}

function RegistryCard({ title, columns, onImport, onExport, onImported }: RegistryCardProps) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<RegistryImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!file) return
    setBusy(true)
    setError(null)
    setSummary(null)
    try {
      setSummary(await onImport(file))
      onImported()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    setError(null)
    try {
      await onExport()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="card registry-card">
      <h2>{title}</h2>
      <p className="muted small">
        Carregue a planilha salva como CSV. Só são preenchidos os campos em branco; um valor diferente do que já existe vai para os conflitos, abaixo.
      </p>
      <p className="muted small">Colunas: {columns}.</p>
      <ErrorBanner message={error} />
      <div className="registry-actions">
        <input type="file" accept=".csv,text/csv" aria-label={`Arquivo CSV de ${title}`} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" className="button button-primary" disabled={!file || busy} onClick={load}>
          {busy ? 'Carregando…' : 'Carregar'}
        </button>
        <button type="button" className="button" onClick={download}>
          Baixar CSV
        </button>
      </div>
      {summary && (
        <p className="banner banner-success" role="status">
          {summary.rows} linhas lidas: {summary.created} novos, {summary.filled} completados, {summary.unchanged} sem mudança,{' '}
          {summary.conflicts} conflitos{summary.skipped > 0 ? `, ${summary.skipped} ignoradas (sem código)` : ''}.
        </p>
      )}
    </div>
  )
}

function Conflicts({ version }: { version: number }) {
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [page, setPage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const conflicts = useLoad(() => accountingApi.conflicts(onlyOpen, page, PAGE_SIZE), [onlyOpen, page, version])
  const result = conflicts.data

  async function review(id: number) {
    setError(null)
    try {
      await accountingApi.markConflictReviewed(id)
      conflicts.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Conflitos de cadastro</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!onlyOpen}
            onChange={(e) => {
              setOnlyOpen(!e.target.checked)
              setPage(0)
            }}
          />
          Mostrar revisados
        </label>
        <button type="button" className="button button-small" onClick={() => accountingApi.exportConflicts(onlyOpen).catch((caught) => setError(errorMessage(caught)))}>
          Baixar CSV
        </button>
      </div>
      <ErrorBanner message={error ?? conflicts.error} onRetry={conflicts.error ? conflicts.reload : undefined} />
      {conflicts.loading && !result && <Loading />}
      {result && (
        <>
          <div className="table-wrapper">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Base</th>
                  <th>Registro</th>
                  <th>Empresa</th>
                  <th>Valor atual</th>
                  <th>Valor sugerido</th>
                  <th>Origem</th>
                  <th>Quando</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {result.items.map((conflict) => (
                  <tr key={conflict.id}>
                    <td>{BASE_LABELS[conflict.base]}</td>
                    <td>{conflict.recordKey}</td>
                    <td>{conflict.companyName}</td>
                    <td>{conflict.currentValue}</td>
                    <td>{conflict.suggestedValue}</td>
                    <td className="muted small">{conflict.source}</td>
                    <td className="muted small">{formatDateTime(conflict.createdAt)}</td>
                    <td className="row-actions">
                      {conflict.reviewed ? (
                        <span className="muted small">Revisado</span>
                      ) : (
                        <button type="button" className="button button-small" onClick={() => review(conflict.id)}>
                          Marcar revisado
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted empty-row">
                      {onlyOpen ? 'Nenhum conflito para revisar.' : 'Nenhum conflito registrado.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={result.totalPages} totalItems={result.totalItems} noun="conflitos" onPage={setPage} />
        </>
      )}
    </div>
  )
}
