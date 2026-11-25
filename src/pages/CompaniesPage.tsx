import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { companiesApi, usersApi } from '../api/endpoints'
import type { Company, User } from '../api/types'
import { CheckboxList } from '../components/CheckboxList'
import { normalize, onlyDigits } from '../lib/text'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { ErrorBanner, Field, Loading, Modal, Segmented } from '../components/ui'
import { useLoad } from '../lib/useLoad'

/** Names of the users notified about a company's slips, for the list column. */
function userNames(userIds: number[], users: User[]): string {
  if (userIds.length === 0) return 'Nenhum'
  return userIds.map((id) => users.find((u) => u.id === id)?.name ?? '?').join(', ')
}

interface CompanyFilters {
  /** Part of the name or the trade name; case and accents ignored. */
  name: string
  /** Part of the CNPJ, with or without punctuation. */
  cnpj: string
  cigamCode: string
  dominioCode: string
  /** `''` = all. */
  status: '' | 'active' | 'inactive'
}

const EMPTY_FILTERS: CompanyFilters = { name: '', cnpj: '', cigamCode: '', dominioCode: '', status: '' }

/** CNPJ without punctuation, upper case (the alphanumeric format has letters). */
function plainCnpj(text: string): string {
  return text.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

/**
 * The list is small and comes whole from the API, so it is filtered here, as the user types
 * (asked by the user on 25/11/2026). Each filter matches any part of its field.
 */
function matches(company: Company, filters: CompanyFilters): boolean {
  const name = normalize(filters.name.trim())
  if (name && !normalize(`${company.name} ${company.tradeName ?? ''}`).includes(name)) return false
  const cnpj = plainCnpj(filters.cnpj)
  if (cnpj && !company.cnpj.includes(cnpj)) return false
  if (filters.cigamCode && !(company.cigamCode ?? '').includes(filters.cigamCode)) return false
  if (filters.dominioCode && !(company.dominioCode ?? '').includes(filters.dominioCode)) return false
  if (filters.status && company.active !== (filters.status === 'active')) return false
  return true
}

export function CompaniesPage() {
  const companies = useLoad(() => companiesApi.list(), [])
  const users = useLoad(() => usersApi.list(), [])
  /** `null` = closed, `'new'` = creating, otherwise the company being edited. */
  const [editing, setEditing] = useState<Company | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CompanyFilters>(EMPTY_FILTERS)
  const hasFilters = Object.values(filters).some(Boolean)
  const shown = (companies.data ?? []).filter((company) => matches(company, filters))

  function setFilter<K extends keyof CompanyFilters>(name: K, value: CompanyFilters[K]) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  async function remove(company: Company) {
    if (!window.confirm(`Excluir a empresa "${company.name}"?`)) return
    setError(null)
    try {
      await companiesApi.remove(company.id)
      companies.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Empresas</h1>
          <div className="page-subtitle">
            {companies.data
              ? hasFilters
                ? `${shown.length} de ${companies.data.length} ${companies.data.length === 1 ? 'empresa' : 'empresas'}`
                : `${companies.data.length} ${companies.data.length === 1 ? 'empresa' : 'empresas'}`
              : '\u00a0'}
          </div>
        </div>
        <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
          Nova empresa
        </button>
      </div>
      <ErrorBanner message={error ?? companies.error} onRetry={companies.error ? companies.reload : undefined} />
      {companies.loading && !companies.data && <Loading />}
      <div className="card filters filters-companies">
        <Field label="Empresa">
          <input
            type="search"
            value={filters.name}
            onChange={(e) => setFilter('name', e.target.value)}
            placeholder="Parte do nome ou do nome fantasia"
          />
        </Field>
        <Field label="CNPJ">
          <input value={filters.cnpj} onChange={(e) => setFilter('cnpj', e.target.value)} placeholder="Completo ou parcial" />
        </Field>
        <Field label="Cód. Cigam">
          <input
            inputMode="numeric"
            maxLength={10}
            value={filters.cigamCode}
            onChange={(e) => setFilter('cigamCode', onlyDigits(e.target.value))}
            placeholder="Parte do código"
          />
        </Field>
        <Field label="Cód. Domínio">
          <input
            inputMode="numeric"
            maxLength={10}
            value={filters.dominioCode}
            onChange={(e) => setFilter('dominioCode', onlyDigits(e.target.value))}
            placeholder="Parte do código"
          />
        </Field>
        <Field label="Status" group>
          <Segmented
            label="Status"
            options={[
              { value: '', label: 'Todos' },
              { value: 'active', label: 'Ativo' },
              { value: 'inactive', label: 'Inativo' },
            ]}
            value={filters.status}
            onChange={(value) => setFilter('status', value)}
          />
        </Field>
        <div className="filters-companies-end">
          {hasFilters && (
            <button type="button" className="link-button" onClick={() => setFilters(EMPTY_FILTERS)}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>
      {companies.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Nome fantasia</th>
                <th>CNPJ</th>
                <th>Cód. Cigam</th>
                <th>Cód. Domínio</th>
                <th>Status</th>
                <th>Usuários notificados</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {shown.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{company.tradeName}</td>
                  <td className="nowrap">{company.formattedCnpj}</td>
                  <td>{company.cigamCode ?? <span className="muted">—</span>}</td>
                  <td>{company.dominioCode ?? <span className="muted">—</span>}</td>
                  <td>
                    <span className={`badge ${company.active ? 'badge-paid' : 'badge-archived'}`}>
                      {company.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>{userNames(company.notifiedUserIds, users.data ?? [])}</td>
                  <td className="row-actions">
                    <IconButton label={`Editar ${company.name}`} onClick={() => setEditing(company)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton label={`Excluir ${company.name}`} onClick={() => remove(company)} danger>
                      <DeleteIcon />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted empty-row">
                    {hasFilters ? 'Nenhuma empresa encontrada com estes filtros.' : 'Nenhuma empresa cadastrada ainda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <CompanyForm
          company={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            companies.reload()
          }}
        />
      )}
    </>
  )
}

interface CompanyFormProps {
  company: Company | null
  onClose: () => void
  onSaved: () => void
}

function CompanyForm({ company, onClose, onSaved }: CompanyFormProps) {
  const users = useLoad(() => usersApi.list(), [])
  const [name, setName] = useState(company?.name ?? '')
  const [tradeName, setTradeName] = useState(company?.tradeName ?? '')
  const [cnpj, setCnpj] = useState(company?.formattedCnpj ?? '')
  const [active, setActive] = useState(company?.active ?? true)
  const [cigamCode, setCigamCode] = useState(company?.cigamCode ?? '')
  const [dominioCode, setDominioCode] = useState(company?.dominioCode ?? '')
  const [notifiedUserIds, setNotifiedUserIds] = useState((company?.notifiedUserIds ?? []).map(String))
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})
    try {
      const input = {
        name,
        cnpj,
        tradeName: tradeName.trim() || null,
        active,
        notifiedUserIds: notifiedUserIds.map(Number),
        cigamCode: cigamCode || null,
        dominioCode: dominioCode || null,
      }
      if (company) await companiesApi.update(company.id, input)
      else await companiesApi.create(input)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
      setSubmitting(false)
    }
  }

  return (
    <Modal title={company ? 'Editar empresa' : 'Nova empresa'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <Field label="Nome" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required autoFocus />
        </Field>
        <Field label="Nome fantasia" error={errors.tradeName} hint="Opcional.">
          <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} maxLength={200} />
        </Field>
        <Field label="CNPJ" error={errors.cnpj} hint="Com ou sem pontuação; aceita o formato alfanumérico.">
          <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" required />
        </Field>
        {/* The group's company mapping: optional, digits only, leading zeros kept (asked on 25/11/2026). */}
        <div className="form-row">
          <Field label="Cód. Cigam" error={errors.cigamCode} hint="Opcional. Só dígitos.">
            <input inputMode="numeric" maxLength={10} value={cigamCode} onChange={(e) => setCigamCode(onlyDigits(e.target.value))} />
          </Field>
          <Field label="Cód. Domínio" error={errors.dominioCode} hint="Opcional. Só dígitos.">
            <input inputMode="numeric" maxLength={10} value={dominioCode} onChange={(e) => setDominioCode(onlyDigits(e.target.value))} />
          </Field>
        </div>
        <Field
          label="Status"
          group
          hint={active ? undefined : 'Inativa: não aparece no cadastro de guia nem de parcelamento.'}
        >
          <Segmented
            label="Status"
            options={[
              { value: 'active', label: 'Ativo' },
              { value: 'inactive', label: 'Inativo' },
            ]}
            value={active ? 'active' : 'inactive'}
            onChange={(value) => setActive(value === 'active')}
          />
        </Field>
        <Field label="Usuários notificados" group>
          <CheckboxList
            options={(users.data ?? []).map((user) => ({ value: String(user.id), label: user.name }))}
            selected={notifiedUserIds}
            onChange={setNotifiedUserIds}
            emptyText="Nenhum usuário cadastrado."
          />
        </Field>
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
