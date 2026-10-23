import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { accountingApi, companiesApi } from '../api/endpoints'
import type { ChartAccount, ChartAccountMapping, Company } from '../api/types'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { ErrorBanner, Field, Loading, Modal } from '../components/ui'
import { Pagination } from '../components/Pagination'
import { accountingCompanies } from '../lib/accounting'
import { useLoad } from '../lib/useLoad'

const PAGE_SIZE = 50

/** The Depara: source accounts and their Domínio code in each company (administrator only). */
export function ChartAccountsPage() {
  const companies = useLoad(() => companiesApi.list(), [])
  const columns = accountingCompanies(companies.data ?? [])
  const [textInput, setTextInput] = useState('')
  const [text, setText] = useState('')
  const [pendingForCompanyId, setPendingForCompanyId] = useState('')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<ChartAccount | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const accounts = useLoad(() => accountingApi.chartAccounts({ text, pendingForCompanyId }, page, PAGE_SIZE), [text, pendingForCompanyId, page])

  // Typed freely; applied after a short pause so each keystroke doesn't fire a request.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setText(textInput)
      setPage(0)
    }, 400)
    return () => clearTimeout(timeout)
  }, [textInput])

  async function remove(account: ChartAccount) {
    if (!window.confirm(`Excluir a conta ${account.sourceCode} (${account.description})?`)) return
    setError(null)
    try {
      await accountingApi.removeChartAccount(account.id)
      accounts.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const result = accounts.data
  return (
    <>
      <div className="card filters accounting-filters">
        <Field label="Buscar">
          <input value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Código, conta contábil ou descrição" />
        </Field>
        <Field label="Pendentes para">
          <select
            value={pendingForCompanyId}
            onChange={(e) => {
              setPendingForCompanyId(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Todas as contas</option>
            {columns.map((company) => (
              <option key={company.id} value={company.id}>
                {company.accounting.shortName}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
          Nova conta
        </button>
      </div>
      {companies.data && columns.length === 0 && (
        <p className="muted">Informe o nome curto das empresas (Empresas, seção Importação contábil) para as colunas aparecerem.</p>
      )}
      <ErrorBanner message={error ?? accounts.error ?? companies.error} onRetry={accounts.error ? accounts.reload : undefined} />
      {accounts.loading && !result && <Loading />}
      {result && (
        <div className="card">
          <div className="table-wrapper">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Conta contábil</th>
                  <th>Descrição</th>
                  {columns.map((company) => (
                    <th key={company.id}>{company.accounting.shortName}</th>
                  ))}
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {result.items.map((account) => (
                  <tr key={account.id}>
                    <td>{account.sourceCode}</td>
                    <td className="muted">{account.ledgerAccount}</td>
                    <td>{account.description}</td>
                    {columns.map((company) => (
                      <td key={company.id}>
                        <MappingCell mapping={account.mappings.find((m) => m.companyId === company.id)} />
                      </td>
                    ))}
                    <td className="row-actions">
                      <IconButton label={`Editar ${account.sourceCode}`} onClick={() => setEditing(account)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton label={`Excluir ${account.sourceCode}`} onClick={() => remove(account)} danger>
                        <DeleteIcon />
                      </IconButton>
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={4 + columns.length} className="muted empty-row">
                      Nenhuma conta encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={result.totalPages} totalItems={result.totalItems} noun="contas" onPage={setPage} />
        </div>
      )}
      {editing && (
        <ChartAccountForm
          account={editing === 'new' ? null : editing}
          companies={columns}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            accounts.reload()
          }}
        />
      )}
    </>
  )
}

function MappingCell({ mapping }: { mapping: ChartAccountMapping | undefined }) {
  if (mapping?.ignored) return <span className="muted" title="Desconsiderada nesta empresa">0</span>
  if (mapping?.domainCode) return <>{mapping.domainCode}</>
  return <span className="badge badge-pending">Pendente</span>
}

interface ChartAccountFormProps {
  account: ChartAccount | null
  companies: Company[]
  onClose: () => void
  onSaved: () => void
}

function ChartAccountForm({ account, companies, onClose, onSaved }: ChartAccountFormProps) {
  const [sourceCode, setSourceCode] = useState(account?.sourceCode ?? '')
  const [ledgerAccount, setLedgerAccount] = useState(account?.ledgerAccount ?? '')
  const [description, setDescription] = useState(account?.description ?? '')
  const [accountType, setAccountType] = useState(account?.accountType ?? 'Analítica')
  const [resultType, setResultType] = useState(account?.resultType ?? 'Não Acumula')
  const [mappings, setMappings] = useState<Record<number, { code: string; ignored: boolean }>>(() =>
    Object.fromEntries(
      companies.map((company) => {
        const mapping = account?.mappings.find((m) => m.companyId === company.id)
        return [company.id, { code: mapping?.domainCode ?? '', ignored: mapping?.ignored ?? false }]
      }),
    ),
  )
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function setMapping(companyId: number, change: Partial<{ code: string; ignored: boolean }>) {
    setMappings((current) => ({ ...current, [companyId]: { ...current[companyId], ...change } }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})
    // Mappings of companies without a short name are not on screen: they are kept as they were.
    const hidden = (account?.mappings ?? []).filter((m) => !companies.some((company) => company.id === m.companyId))
    const input = {
      sourceCode,
      ledgerAccount: ledgerAccount.trim() || null,
      description,
      accountType: accountType.trim() || null,
      resultType: resultType.trim() || null,
      mappings: [
        ...hidden,
        ...Object.entries(mappings)
          .filter(([, mapping]) => mapping.ignored || mapping.code.trim())
          .map(([companyId, mapping]) => ({
            companyId: Number(companyId),
            domainCode: mapping.ignored ? null : mapping.code.trim(),
            ignored: mapping.ignored,
          })),
      ],
    }
    try {
      if (account) await accountingApi.updateChartAccount(account.id, input)
      else await accountingApi.createChartAccount(input)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
      setSubmitting(false)
    }
  }

  return (
    <Modal title={account ? `Conta ${account.sourceCode}` : 'Nova conta'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <div className="form-row">
          <Field label="Código de origem" error={errors.sourceCode}>
            <input value={sourceCode} onChange={(e) => setSourceCode(e.target.value)} maxLength={20} required autoFocus={!account} />
          </Field>
          <Field label="Conta contábil" error={errors.ledgerAccount} hint="O grau sai dela.">
            <input value={ledgerAccount} onChange={(e) => setLedgerAccount(e.target.value)} maxLength={40} placeholder="1.1.1.02.01.031" />
          </Field>
        </div>
        <Field label="Descrição" error={errors.description}>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} required />
        </Field>
        <div className="form-row">
          <Field label="Tipo">
            <input value={accountType} onChange={(e) => setAccountType(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Resultado">
            <input value={resultType} onChange={(e) => setResultType(e.target.value)} maxLength={40} />
          </Field>
        </div>
        <fieldset className="form-section">
          <legend>Código Domínio por empresa</legend>
          {companies.length === 0 && <p className="muted small">Nenhuma empresa tem nome curto cadastrado.</p>}
          {companies.map((company) => (
            <div key={company.id} className="mapping-row">
              <span>{company.accounting.shortName}</span>
              <input
                inputMode="numeric"
                aria-label={`Código Domínio na ${company.accounting.shortName}`}
                value={mappings[company.id]?.code ?? ''}
                disabled={mappings[company.id]?.ignored}
                onChange={(e) => setMapping(company.id, { code: e.target.value.replace(/\D/g, '') })}
                maxLength={20}
                placeholder="Pendente"
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={mappings[company.id]?.ignored ?? false}
                  onChange={(e) => setMapping(company.id, { ignored: e.target.checked, code: '' })}
                />
                Desconsiderar
              </label>
            </div>
          ))}
        </fieldset>
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}
