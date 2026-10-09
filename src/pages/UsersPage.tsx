import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { companiesApi, usersApi } from '../api/endpoints'
import type { User, UserRole } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CheckboxList } from '../components/CheckboxList'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { ErrorBanner, Field, Loading, Modal } from '../components/ui'
import { ROLE_LABELS, formatDateTime } from '../lib/format'
import { useLoad } from '../lib/useLoad'

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const users = useLoad(() => usersApi.list(), [])
  /** `null` = closed, `'new'` = creating, otherwise the user being edited. */
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(user: User) {
    if (!window.confirm(`Excluir o usuário "${user.name}"?`)) return
    setError(null)
    try {
      await usersApi.remove(user.id)
      users.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Usuários</h1>
        <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
          Novo usuário
        </button>
      </div>
      <ErrorBanner message={error ?? users.error} onRetry={users.error ? users.reload : undefined} />
      {users.loading && !users.data && <Loading />}
      {users.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Atualizado em</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {users.data.map((user) => {
                const isSelf = user.id === currentUser?.id
                return (
                  <tr key={user.id}>
                    <td>
                      {user.name} {isSelf && <span className="muted small">(você)</span>}
                    </td>
                    <td>{user.email}</td>
                    <td>{ROLE_LABELS[user.role]}</td>
                    <td>
                      <span className={`badge ${user.active ? 'badge-paid' : 'badge-archived'}`}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>{formatDateTime(user.updatedAt)}</td>
                    <td className="row-actions">
                      <IconButton label={`Editar ${user.name}`} onClick={() => setEditing(user)}>
                        <EditIcon />
                      </IconButton>
                      {!isSelf && (
                        <IconButton label={`Excluir ${user.name}`} onClick={() => remove(user)} danger>
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <UserForm
          user={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.id === currentUser?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            users.reload()
          }}
        />
      )}
    </>
  )
}

interface UserFormProps {
  user: User | null
  isSelf: boolean
  onClose: () => void
  onSaved: () => void
}

function UserForm({ user, isSelf, onClose, onSaved }: UserFormProps) {
  const companies = useLoad(() => companiesApi.list(), [])
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'FISCAL')
  const [password, setPassword] = useState('')
  const [notificationCompanyIds, setNotificationCompanyIds] = useState(
    (user?.notificationCompanyIds ?? []).map(String),
  )
  const [active, setActive] = useState(user?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})
    const input = {
      name,
      email,
      role,
      notificationCompanyIds: notificationCompanyIds.map(Number),
      active,
      password: password || undefined,
    }
    try {
      if (user) await usersApi.update(user.id, input)
      else await usersApi.create(input)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
      setSubmitting(false)
    }
  }

  return (
    <Modal title={user ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <Field label="Nome" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required autoFocus />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Tipo" error={errors.role}>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={user ? 'Nova senha' : 'Senha'}
          error={errors.password}
          hint={user ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 8 caracteres.'}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required={!user}
          />
        </Field>
        <Field label="Empresas notificadas" group>
          <CheckboxList
            options={(companies.data ?? []).map((company) => ({ value: String(company.id), label: company.name }))}
            selected={notificationCompanyIds}
            onChange={setNotificationCompanyIds}
            emptyText="Nenhuma empresa cadastrada."
            selectAllText="Marcar todas"
            clearAllText="Desmarcar todas"
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
          Ativo {isSelf && <span className="muted small">(você não pode desativar o próprio usuário)</span>}
        </label>
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
