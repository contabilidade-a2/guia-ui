import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { slipTypesApi } from '../api/endpoints'
import type { SlipType } from '../api/types'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { ErrorBanner, Field, Loading, Modal } from '../components/ui'
import { useLoad } from '../lib/useLoad'

export function SlipTypesPage() {
  const slipTypes = useLoad(() => slipTypesApi.list(), [])
  /** `null` = closed, `'new'` = creating, otherwise the type being edited. */
  const [editing, setEditing] = useState<SlipType | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(slipType: SlipType) {
    if (!window.confirm(`Excluir o tipo de guia "${slipType.name}"?`)) return
    setError(null)
    try {
      await slipTypesApi.remove(slipType.id)
      slipTypes.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Tipos de guia</h1>
        <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
          Novo tipo
        </button>
      </div>
      <ErrorBanner message={error ?? slipTypes.error} onRetry={slipTypes.error ? slipTypes.reload : undefined} />
      {slipTypes.loading && !slipTypes.data && <Loading />}
      {slipTypes.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {slipTypes.data.map((slipType) => (
                <tr key={slipType.id}>
                  <td>{slipType.name}</td>
                  <td className="row-actions">
                    <IconButton label={`Editar ${slipType.name}`} onClick={() => setEditing(slipType)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton label={`Excluir ${slipType.name}`} onClick={() => remove(slipType)} danger>
                      <DeleteIcon />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {slipTypes.data.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted empty-row">
                    Nenhum tipo de guia cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <SlipTypeForm
          slipType={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            slipTypes.reload()
          }}
        />
      )}
    </>
  )
}

interface SlipTypeFormProps {
  slipType: SlipType | null
  onClose: () => void
  onSaved: () => void
}

function SlipTypeForm({ slipType, onClose, onSaved }: SlipTypeFormProps) {
  const [name, setName] = useState(slipType?.name ?? '')
  const [installment, setInstallment] = useState(slipType?.installment ?? false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})
    try {
      if (slipType) await slipTypesApi.update(slipType.id, { name, installment })
      else await slipTypesApi.create({ name, installment })
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
      setSubmitting(false)
    }
  }

  return (
    <Modal title={slipType ? 'Editar tipo de guia' : 'Novo tipo de guia'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <Field label="Nome" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={installment} onChange={(e) => setInstallment(e.target.checked)} />
          Tipo de parcelamento
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
