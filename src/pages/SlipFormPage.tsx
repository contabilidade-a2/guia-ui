import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage, fieldErrors } from '../api/client'
import { companiesApi, installmentPlansApi, slipTypesApi, slipsApi } from '../api/endpoints'
import type { Company, InstallmentPlan, SendStatus, SlipDetail, SlipInput, SlipType } from '../api/types'
import { CurrencyInput } from '../components/CurrencyInput'
import { ChevronLeftIcon } from '../components/icons'
import { MonthInput } from '../components/MonthInput'
import { SearchableSelect } from '../components/SearchableSelect'
import { ErrorBanner, Field, Loading } from '../components/ui'
import { SEND_STATUS_LABELS, firstDayOfMonth } from '../lib/format'
import { useLoad } from '../lib/useLoad'

interface FormState {
  subject: string
  note: string
  cigamNumber: string
  /** Which installment of the plan this slip pays (plan slips only). */
  installmentNumber: string
  /** Display only: comes from the plan, the server sets it. */
  origin: string
  companyId: string
  slipTypeId: string
  installmentPlanId: string
  amount: string
  /** `yyyy-MM` */
  competenceDate: string
  dueDate: string
  fileUrl: string
  sendStatus: SendStatus
}

const EMPTY_FORM: FormState = {
  subject: '',
  note: '',
  cigamNumber: '',
  installmentNumber: '',
  origin: '',
  companyId: '',
  slipTypeId: '',
  installmentPlanId: '',
  amount: '',
  competenceDate: '',
  dueDate: '',
  fileUrl: '',
  sendStatus: 'SENT',
}

function toFormState(slip: SlipDetail | null): FormState {
  if (!slip) return EMPTY_FORM
  return {
    subject: slip.subject,
    note: slip.note ?? '',
    cigamNumber: slip.cigamNumber ?? '',
    installmentNumber: slip.installmentNumber === null ? '' : String(slip.installmentNumber),
    origin: slip.origin ?? '',
    companyId: String(slip.company.id),
    slipTypeId: String(slip.slipType.id),
    installmentPlanId: slip.installmentPlanId === null ? '' : String(slip.installmentPlanId),
    amount: String(slip.amount),
    competenceDate: slip.competenceDate.slice(0, 7),
    dueDate: slip.dueDate,
    fileUrl: slip.fileUrl ?? '',
    sendStatus: slip.sendStatus,
  }
}

export function SlipFormPage() {
  const params = useParams()
  const slipId = params.id ? Number(params.id) : null

  const loaded = useLoad(async () => {
    const [companies, slipTypes, activePlans, slip] = await Promise.all([
      companiesApi.list(),
      slipTypesApi.list(),
      installmentPlansApi.activeOptions(),
      slipId === null ? null : slipsApi.get(slipId),
    ])
    // Only active plans are offered, but a slip keeps showing the plan it already has, whatever its status.
    const ownPlanId = slip?.installmentPlanId ?? null
    const ownPlan =
      ownPlanId !== null && !activePlans.some((plan) => plan.id === ownPlanId)
        ? await installmentPlansApi.get(ownPlanId)
        : null
    return [companies, slipTypes, ownPlan ? [...activePlans, ownPlan] : activePlans, slip] as const
  }, [slipId])

  return (
    <div className="form-page">
      <Link to={slipId === null ? '/slips' : `/slips/${slipId}`} className="back-link">
        <ChevronLeftIcon />
        {slipId === null ? 'Voltar para guias' : 'Voltar para a guia'}
      </Link>
      <div className="page-header">
        <h1>{slipId === null ? 'Nova guia' : 'Editar guia'}</h1>
      </div>
      <ErrorBanner message={loaded.error} onRetry={loaded.reload} />
      {loaded.loading && !loaded.data && <Loading />}
      {loaded.data && (
        <SlipForm
          key={slipId ?? 'new'}
          slipId={slipId}
          companies={loaded.data[0]}
          slipTypes={loaded.data[1]}
          installmentPlans={loaded.data[2]}
          slip={loaded.data[3]}
        />
      )}
    </div>
  )
}

interface SlipFormProps {
  slipId: number | null
  companies: Company[]
  slipTypes: SlipType[]
  installmentPlans: InstallmentPlan[]
  slip: SlipDetail | null
}

function SlipForm({ slipId, companies, slipTypes, installmentPlans, slip }: SlipFormProps) {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(() => toFormState(slip))
  // A slip with a registered payment cannot be canceled (the server enforces it too).
  const paid = slip !== null && (slip.receiptUrl !== null || slip.status === 'PAID')
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  // Which button submitted the form: the plain one goes to the slip, the other starts a new one.
  const saveAndNew = useRef(false)

  function set<K extends keyof FormState>(name: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  // Picking a plan locks (and fills) the company, subject and Cigam number; clearing it just unlocks them.
  function selectInstallmentPlan(idText: string) {
    const plan = installmentPlans.find((p) => String(p.id) === idText)
    if (!plan) {
      set('installmentPlanId', '')
      return
    }
    setForm((current) => ({
      ...current,
      installmentPlanId: idText,
      installmentNumber: current.installmentPlanId === idText ? current.installmentNumber : '',
      companyId: String(plan.company.id),
      subject: plan.subject,
      cigamNumber: plan.cigamNumber,
      origin: plan.origin,
    }))
  }

  const hasPlan = form.installmentPlanId !== ''
  const isInstallmentType = slipTypes.find((type) => String(type.id) === form.slipTypeId)?.installment ?? false
  const selectedPlan = installmentPlans.find((plan) => String(plan.id) === form.installmentPlanId)
  // Active plans of the chosen company (all companies while none is chosen); the plan already picked always stays.
  const selectablePlans = installmentPlans.filter(
    (plan) =>
      String(plan.id) === form.installmentPlanId ||
      (plan.status === 'ACTIVE' && (form.companyId === '' || String(plan.company.id) === form.companyId)),
  )

  // Moving to an installment type clears the company, so every active plan can be picked (the plan then sets
  // the company). Leaving it drops the plan and what came from it, which unlocks company, subject and Cigam.
  function selectSlipType(idText: string) {
    const installment = slipTypes.find((type) => String(type.id) === idText)?.installment ?? false
    setForm((current) => {
      const wasInstallment = slipTypes.find((type) => String(type.id) === current.slipTypeId)?.installment ?? false
      const dropsPlan = !installment && current.installmentPlanId !== ''
      return {
        ...current,
        slipTypeId: idText,
        companyId: installment && !wasInstallment ? '' : current.companyId,
        installmentPlanId: installment ? current.installmentPlanId : '',
        installmentNumber: installment ? current.installmentNumber : '',
        subject: dropsPlan ? '' : current.subject,
        cigamNumber: dropsPlan ? '' : current.cigamNumber,
        origin: dropsPlan ? '' : current.origin,
      }
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})
    setSaved(null)
    const input: SlipInput = {
      subject: form.subject,
      note: form.note || null,
      cigamNumber: form.cigamNumber || null,
      companyId: form.companyId ? Number(form.companyId) : null,
      slipTypeId: form.slipTypeId ? Number(form.slipTypeId) : null,
      amount: form.amount ? Number(form.amount) : null,
      competenceDate: form.competenceDate ? firstDayOfMonth(form.competenceDate) : null,
      dueDate: form.dueDate || null,
      fileUrl: form.fileUrl,
      sendStatus: slipId === null ? undefined : form.sendStatus,
      installmentPlanId: form.installmentPlanId ? Number(form.installmentPlanId) : null,
      installmentNumber: form.installmentPlanId && form.installmentNumber ? Number(form.installmentNumber) : null,
    }
    try {
      const result = slipId === null ? await slipsApi.create(input) : await slipsApi.update(slipId, input)
      if (saveAndNew.current && slipId === null) {
        setSaved(`Guia "${result.subject}" cadastrada. Preencha a próxima.`)
        setForm(EMPTY_FORM)
        setSubmitting(false)
        window.scrollTo({ top: 0 })
        return
      }
      navigate(`/slips/${result.id}`)
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
      setSubmitting(false)
    }
  }

  const backTo = slipId === null ? '/slips' : `/slips/${slipId}`

  return (
    <form className="form form-sections" onSubmit={submit}>
      {saved && (
        <div className="banner banner-success" role="status">
          <span>{saved}</span>
        </div>
      )}
      <ErrorBanner message={error} />

      <fieldset className="form-section">
        <legend>Identificação</legend>
        <div className="form-row">
          <Field label="Tipo de guia" group error={errors.slipTypeId}>
            <SearchableSelect
              label="Tipo de guia"
              options={slipTypes.map((slipType) => ({ value: String(slipType.id), label: slipType.name }))}
              value={form.slipTypeId}
              onChange={selectSlipType}
              required
            />
          </Field>
          <Field label="Parcelamento" group hint={isInstallmentType ? 'Opcional.' : 'Só para tipos de guia de parcelamento.'}>
            <SearchableSelect
              label="Parcelamento"
              options={selectablePlans.map((plan) => ({
                value: String(plan.id),
                label: `${plan.subject} (${plan.company.name})`,
              }))}
              value={form.installmentPlanId}
              onChange={selectInstallmentPlan}
              clearLabel="Nenhum"
              placeholder="Nenhum"
              disabled={!isInstallmentType}
            />
          </Field>
          <Field label="Empresa" group error={errors.companyId} hint={hasPlan ? 'Vem do parcelamento.' : undefined}>
            <SearchableSelect
              label="Empresa"
              options={companies.map((company) => ({ value: String(company.id), label: company.label }))}
              value={form.companyId}
              onChange={(value) => set('companyId', value)}
              required
              disabled={hasPlan}
            />
          </Field>
        </div>
        <Field
          label="Assunto"
          error={errors.subject}
          hint={hasPlan ? 'Empresa, assunto, origem e número Cigam vêm do parcelamento.' : undefined}
        >
          <input
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
            maxLength={200}
            required
            disabled={hasPlan}
          />
        </Field>
        {hasPlan && (
          <div className="form-row">
            <Field label="Origem">
              <input value={form.origin} disabled />
            </Field>
            <Field label="Número Cigam" error={errors.cigamNumber}>
              <input value={form.cigamNumber} disabled />
            </Field>
            <Field
              label="Parcela número"
              error={errors.installmentNumber}
              hint={selectedPlan ? `De 1 a ${selectedPlan.installmentCount}.` : undefined}
            >
              <input
                type="number"
                min="1"
                max={selectedPlan?.installmentCount}
                step="1"
                value={form.installmentNumber}
                onChange={(e) => set('installmentNumber', e.target.value)}
                required
              />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="form-section">
        <legend>Valor e datas</legend>
        <div className="form-row">
          <Field label="Valor (R$)" error={errors.amount}>
            <CurrencyInput value={form.amount} onChange={(value) => set('amount', value)} required />
          </Field>
          <Field label="Competência" error={errors.competenceDate}>
            <MonthInput value={form.competenceDate} onChange={(value) => set('competenceDate', value)} required />
          </Field>
          <Field label="Vencimento" error={errors.dueDate}>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} required />
          </Field>
        </div>
      </fieldset>

      {slipId !== null && (
        <fieldset className="form-section">
          <legend>Envio</legend>
          <div className="form-row">
            <Field
              label="Status de envio"
              error={errors.sendStatus}
              hint={paid ? 'Guia com pagamento registrado não pode ser cancelada.' : undefined}
            >
              <select value={form.sendStatus} onChange={(e) => set('sendStatus', e.target.value as SendStatus)}>
                {Object.entries(SEND_STATUS_LABELS)
                  .filter(([value]) => !(paid && value === 'CANCELED' && form.sendStatus !== 'CANCELED'))
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
        </fieldset>
      )}

      <fieldset className="form-section">
        <legend>Arquivo e observação</legend>
        <Field label="Link do PDF da guia" error={errors.fileUrl} hint="Link https do arquivo no OneDrive.">
          <input
            type="url"
            value={form.fileUrl}
            onChange={(e) => set('fileUrl', e.target.value)}
            placeholder="https://"
            required
          />
        </Field>
        <Field label="Observação" error={errors.note} hint="Opcional.">
          <textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={3} />
        </Field>
      </fieldset>

      <div className="form-actions">
        <Link to={backTo} className="button">
          Cancelar
        </Link>
        {slipId === null && (
          <button
            type="submit"
            className="button"
            disabled={submitting}
            onClick={() => (saveAndNew.current = true)}
          >
            Salvar e cadastrar nova
          </button>
        )}
        <button
          type="submit"
          className="button button-primary"
          disabled={submitting}
          onClick={() => (saveAndNew.current = false)}
        >
          {submitting ? 'Salvando…' : 'Salvar guia'}
        </button>
      </div>
    </form>
  )
}
