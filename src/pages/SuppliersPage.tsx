import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { accountingApi, companiesApi } from '../api/endpoints'
import type { Company, Supplier } from '../api/types'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { Pagination } from '../components/Pagination'
import { ErrorBanner, Field, Loading, Modal } from '../components/ui'
import { accountingCompanies, formatDocument } from '../lib/accounting'
import { useLoad } from '../lib/useLoad'

const PAGE_SIZE = 50
const EMPTY_FILTERS = { name: '', document: '', companyCode: '' }

/** The Fornecedores registry: supplier code of the export, name, CPF/CNPJ and Domínio account per company. */
export function SuppliersPage() {
  const companies = useLoad(() => companiesApi.list(), [])
  const columns = accountingCompanies(companies.data ?? [])
  const [inputs, setInputs] = useState(EMPTY_FILTERS)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const suppliers = useLoad(() => accountingApi.suppliers(filters, page, PAGE_SIZE), [filters, page])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters(inputs)
      setPage(0)
    }, 400)
    return () => clearTimeout(timeout)
  }, [inputs])

  async function remove(supplier: Supplier) {
    if (!window.confirm(`Excluir o fornecedor ${supplier.name}?`)) return
    setError(null)
    try {
      await accountingApi.removeSupplier(supplier.id)
      suppliers.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const result = suppliers.data
  return (
    <>
      <div className="card filters accounting-filters">
        <Field label="Nome">
          <input value={inputs.name} onChange={(e) => setInputs({ ...inputs, name: e.target.value })} />
        </Field>
        <Field label="CPF/CNPJ">
          <input value={inputs.document} onChange={(e) => setInputs({ ...inputs, document: e.target.value })} />
        </Field>
        <Field label="Código da empresa">
          <input inputMode="numeric" value={inputs.companyCode} onChange={(e) => setInputs({ ...inputs, companyCode: e.target.value })} />
        </Field>
        <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
          Novo fornecedor
        </button>
      </div>
      <ErrorBanner message={error ?? suppliers.error ?? companies.error} onRetry={suppliers.error ? suppliers.reload : undefined} />
      {suppliers.loading && !result && <Loading />}
      {result && (
        <div className="card">
          <div className="table-wrapper">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>CPF/CNPJ</th>
                  {columns.map((company) => (
                    <th key={company.id}>{company.accounting.shortName}</th>
                  ))}
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {result.items.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.companyCode}</td>
                    <td>{supplier.name || <span className="muted">(sem nome)</span>}</td>
                    <td className="muted">{formatDocument(supplier.document)}</td>
                    {columns.map((company) => (
                      <td key={company.id}>{supplier.accounts.find((a) => a.companyId === company.id)?.domainAccount ?? <span className="muted">—</span>}</td>
                    ))}
                    <td className="row-actions">
                      <IconButton label={`Editar ${supplier.name}`} onClick={() => setEditing(supplier)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton label={`Excluir ${supplier.name}`} onClick={() => remove(supplier)} danger>
                        <DeleteIcon />
                      </IconButton>
                    </td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr>
                    <td colSpan={4 + columns.length} className="muted empty-row">
                      Nenhum fornecedor encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={result.totalPages} totalItems={result.totalItems} noun="fornecedores" onPage={setPage} />
        </div>
      )}
      {editing && (
        <SupplierForm
          supplier={editing === 'new' ? null : editing}
          companies={columns}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            suppliers.reload()
          }}
        />
      )}
    </>
  )
}

interface SupplierFormProps {
  supplier: Supplier | null
  companies: Company[]
  onClose: () => void
  onSaved: () => void
}

function SupplierForm({ supplier, companies, onClose, onSaved }: SupplierFormProps) {
  const [companyCode, setCompanyCode] = useState(supplier?.companyCode ?? '')
  const [name, setName] = useState(supplier?.name ?? '')
  const [document, setDocument] = useState(supplier?.document ?? '')
  const [accounts, setAccounts] = useState<Record<number, string>>(() =>
    Object.fromEntries(companies.map((company) => [company.id, supplier?.accounts.find((a) => a.companyId === company.id)?.domainAccount ?? ''])),
  )
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})
    const hidden = (supplier?.accounts ?? []).filter((a) => !companies.some((company) => company.id === a.companyId))
    const input = {
      companyCode,
      name,
      document: document.trim() || null,
      accounts: [
        ...hidden,
        ...Object.entries(accounts)
          .filter(([, account]) => account.trim())
          .map(([companyId, account]) => ({ companyId: Number(companyId), domainAccount: account.trim() })),
      ],
    }
    try {
      if (supplier) await accountingApi.updateSupplier(supplier.id, input)
      else await accountingApi.createSupplier(input)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
      setSubmitting(false)
    }
  }

  return (
    <Modal title={supplier ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <div className="form-row">
          <Field label="Código da empresa" error={errors.companyCode} hint="O código do fornecedor no export.">
            <input
              inputMode="numeric"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value.replace(/\D/g, ''))}
              maxLength={20}
              required
              autoFocus={!supplier}
            />
          </Field>
          <Field label="CPF/CNPJ" error={errors.document} hint="Opcional.">
            <input value={document} onChange={(e) => setDocument(e.target.value)} maxLength={18} />
          </Field>
        </div>
        <Field label="Nome" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
        </Field>
        <fieldset className="form-section">
          <legend>Conta Domínio por empresa</legend>
          {companies.length === 0 && <p className="muted small">Nenhuma empresa tem nome curto cadastrado.</p>}
          {companies.map((company) => (
            <div key={company.id} className="mapping-row">
              <span>{company.accounting.shortName}</span>
              <input
                inputMode="numeric"
                aria-label={`Conta Domínio na ${company.accounting.shortName}`}
                value={accounts[company.id] ?? ''}
                onChange={(e) => setAccounts({ ...accounts, [company.id]: e.target.value.replace(/\D/g, '') })}
                maxLength={20}
                placeholder="Sem conta"
              />
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
