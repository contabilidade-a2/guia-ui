import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { companiesApi, usersApi } from '../api/endpoints'
import type { Company, User } from '../api/types'
import { CheckboxList } from '../components/CheckboxList'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { ErrorBanner, Field, Loading, Modal } from '../components/ui'
import { useLoad } from '../lib/useLoad'

/** Names of the users notified about a company's slips, for the list column. */
function userNames(userIds: number[], users: User[]): string {
  if (userIds.length === 0) return 'Nenhum'
  return userIds.map((id) => users.find((u) => u.id === id)?.name ?? '?').join(', ')
}

export function CompaniesPage() {
  const companies = useLoad(() => companiesApi.list(), [])
  const users = useLoad(() => usersApi.list(), [])
  /** `null` = closed, `'new'` = creating, otherwise the company being edited. */
  const [editing, setEditing] = useState<Company | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        <h1>Empresas</h1>
        <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
          Nova empresa
        </button>
      </div>
      <ErrorBanner message={error ?? companies.error} onRetry={companies.error ? companies.reload : undefined} />
      {companies.loading && !companies.data && <Loading />}
      {companies.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Nome fantasia</th>
                <th>CNPJ</th>
                <th>Usuários notificados</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {companies.data.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{company.tradeName}</td>
                  <td>{company.formattedCnpj}</td>
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
              {companies.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted empty-row">
                    Nenhuma empresa cadastrada ainda.
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
        notifiedUserIds: notifiedUserIds.map(Number),
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
