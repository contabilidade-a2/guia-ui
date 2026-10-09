import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage, fieldErrors } from '../api/client'
import { slipsApi } from '../api/endpoints'
import type { HistoryEntry, SlipDetail } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner, Field, Loading, SendStatusBadge, SlipStatusBadge } from '../components/ui'
import { ChevronLeftIcon } from '../components/icons'
import {
  DELETE_SLIP_CONFIRMATION,
  HISTORY_EVENT_LABELS,
  ORIGIN_LABELS,
  daysFromToday,
  formatDate,
  formatDateTime,
  formatMonth,
  formatMoney,
  relativeDay,
  todayIso,
} from '../lib/format'

export function SlipDetailPage() {
  const slipId = Number(useParams().id)
  // Keyed by id so moving between slips starts from a clean state.
  return <SlipDetailView key={slipId} slipId={slipId} />
}

function SlipDetailView({ slipId }: { slipId: number }) {
  const { canEditSlips, canRegisterPayment } = useAuth()
  const navigate = useNavigate()

  const [slip, setSlip] = useState<SlipDetail | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function open() {
      try {
        const detail = await slipsApi.get(slipId)
        if (!active) return
        setSlip(detail)
        // Recorded once per opening of this screen; the server keeps one per user per day.
        await slipsApi.registerOpening(slipId)
        const entries = await slipsApi.history(slipId)
        if (active) setHistory(entries)
      } catch (caught) {
        if (active) setError(errorMessage(caught))
      }
    }
    void open()
    return () => {
      active = false
    }
  }, [slipId])

  async function onPaymentChanged(updated: SlipDetail) {
    setSlip(updated)
    setHistory(await slipsApi.history(slipId))
  }

  async function deleteSlip() {
    if (!window.confirm(DELETE_SLIP_CONFIRMATION)) return
    setError(null)
    try {
      await slipsApi.remove(slipId)
      navigate('/slips', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function removeReceipt() {
    if (!window.confirm('Remover o comprovante? A guia deixa de constar como paga e a data de pagamento é apagada.')) return
    setError(null)
    try {
      await onPaymentChanged(await slipsApi.removePayment(slipId))
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  if (error && !slip) {
    return (
      <>
        <ErrorBanner message={error} />
        <Link to="/slips">Voltar para a lista</Link>
      </>
    )
  }
  if (!slip) return <Loading />

  const paid = slip.receiptUrl !== null && slip.paymentDate !== null
  const canceled = slip.sendStatus === 'CANCELED'
  // Outlined while there is a payment for this user to register.
  const paymentOpen = canRegisterPayment && !canceled && !paid

  return (
    <>
      <Link to="/slips" className="back-link">
        <ChevronLeftIcon />
        Voltar para guias
      </Link>
      <div className="page-header">
        <div>
          <div className="title-line">
            <h1>{slip.subject}</h1>
            <SlipStatusBadge status={slip.status} />
            <SendStatusBadge status={slip.sendStatus} />
          </div>
          <div className="page-subtitle">
            {slip.company.name} · {dueText(slip)}
          </div>
        </div>
        {canEditSlips && (
          <div className="header-actions">
            <button type="button" className="button button-danger" onClick={deleteSlip}>
              Excluir
            </button>
            <Link to={`/slips/${slip.id}/edit`} className="button">
              Editar
            </Link>
          </div>
        )}
      </div>
      <ErrorBanner message={error} />

      <div className="detail-grid">
        <div className="detail-main">
          <section>
            <h2 className="section-title">Dados da guia</h2>
            <dl className="card data-grid">
              <div>
                <dt>Valor</dt>
                <dd className="data-amount">{formatMoney(slip.amount)}</dd>
              </div>
              <div>
                <dt>Vencimento</dt>
                <dd>{formatDate(slip.dueDate)}</dd>
              </div>
              <div>
                <dt>Competência</dt>
                <dd>{formatMonth(slip.competenceDate)}</dd>
              </div>
              <div>
                <dt>Empresa</dt>
                <dd>{slip.company.label}</dd>
              </div>
              <div>
                <dt>Tipo de guia</dt>
                <dd>{slip.slipType.name}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{slip.origin ? ORIGIN_LABELS[slip.origin] : '—'}</dd>
              </div>
              <div>
                <dt>Número Cigam</dt>
                <dd>{slip.cigamNumber ?? '—'}</dd>
              </div>
              <div>
                <dt>Enviada em</dt>
                <dd>
                  {formatDateTime(slip.sentAt)} · {slip.sentBy}
                </dd>
              </div>
              <div>
                <dt>PDF da guia</dt>
                <dd>
                  {slip.fileUrl ? (
                    <a href={slip.fileUrl} target="_blank" rel="noreferrer">
                      Abrir PDF
                    </a>
                  ) : (
                    <span className="muted">Indisponível: guia cancelada.</span>
                  )}
                </dd>
              </div>
              <div className="data-wide">
                <dt>Observação</dt>
                <dd className="preserve-lines">{slip.note ?? '—'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="section-title">Histórico</h2>
            {history.length === 0 ? (
              <p className="muted">Carregando…</p>
            ) : (
              <ol className="history">
                {history.map((entry, index) => (
                  <li key={index}>
                    <strong>{HISTORY_EVENT_LABELS[entry.eventType]}</strong>
                    <span className="muted">
                      {entry.userName} · {formatDateTime(entry.occurredAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="detail-side">
          <section className={paymentOpen ? 'card payment-card payment-card-open' : 'card payment-card'}>
            <h2>{paymentOpen ? 'Registrar pagamento' : 'Pagamento'}</h2>
            {canceled ? (
              <p className="muted">Guia cancelada: pagamento indisponível.</p>
            ) : paid ? (
              <dl className="details">
                <dt>Pago em</dt>
                <dd>{formatDate(slip.paymentDate!)}</dd>
                <dt>Comprovante</dt>
                <dd>
                  <a href={slip.receiptUrl!} target="_blank" rel="noreferrer">
                    Abrir comprovante
                  </a>
                </dd>
              </dl>
            ) : paymentOpen ? (
              <p className="payment-card-intro">Ao salvar, a guia passa a Paga e o envio vai para Arquivado.</p>
            ) : (
              <p className="muted">Nenhum pagamento registrado.</p>
            )}
            {canRegisterPayment && !canceled && (
              <div className="payment-actions">
                {/* keyed so the form starts over when the receipt is added, replaced or removed */}
                <PaymentForm key={slip.receiptUrl ?? 'none'} slip={slip} onPaid={onPaymentChanged} />
                {slip.receiptUrl && (
                  <button type="button" className="button button-small button-danger" onClick={removeReceipt}>
                    Remover comprovante
                  </button>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}

/** `vence amanhã, 09/10/2026`, `venceu há 2 dias, 06/10/2026` or `paga em 07/10/2026`. */
function dueText(slip: SlipDetail): string {
  if (slip.paymentDate) return `paga em ${formatDate(slip.paymentDate)}`
  const days = daysFromToday(slip.dueDate)
  const verb = days < 0 ? 'venceu' : 'vence'
  return `${verb} ${relativeDay(slip.dueDate)}, ${formatDate(slip.dueDate)}`
}

function PaymentForm({ slip, onPaid }: { slip: SlipDetail; onPaid: (updated: SlipDetail) => void }) {
  const alreadyPaid = slip.receiptUrl !== null
  const [open, setOpen] = useState(!alreadyPaid)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  if (!open) {
    return (
      <button type="button" className="button button-small" onClick={() => setOpen(true)}>
        Substituir comprovante
      </button>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})
    try {
      onPaid(await slipsApi.registerPayment(slip.id, receiptUrl, paymentDate))
      setReceiptUrl('')
      setOpen(false)
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="form payment-form" onSubmit={submit}>
      <ErrorBanner message={error} />
      <Field label="Link do comprovante" error={errors.receiptUrl} hint="Link https do arquivo no OneDrive.">
        <input type="url" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://" required />
      </Field>
      <Field label="Data de pagamento" error={errors.paymentDate} hint="Não pode ser futura.">
        <input type="date" value={paymentDate} max={todayIso()} onChange={(e) => setPaymentDate(e.target.value)} required />
      </Field>
      <div className="form-actions">
        {alreadyPaid && (
          <button type="button" className="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        )}
        <button type="submit" className="button button-primary" disabled={submitting}>
          {alreadyPaid ? 'Substituir comprovante' : 'Salvar pagamento'}
        </button>
      </div>
    </form>
  )
}
