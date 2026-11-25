import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { closingApi } from '../api/endpoints'
import type {
  BalanceStatus,
  BankHolder,
  BankHolderInput,
  ClosingCompanyOption,
  HolderBalance,
  HolderType,
  ImportReport,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CheckboxList } from '../components/CheckboxList'
import { DeleteIcon, EditIcon, IconButton } from '../components/icons'
import { MonthInput } from '../components/MonthInput'
import { SignedMoneyInput } from '../components/SignedMoneyInput'
import { ErrorBanner, Field, Loading, Modal, Segmented } from '../components/ui'
import {
  BALANCE_STATUS_BADGES,
  BALANCE_STATUS_LABELS,
  HOLDER_TYPE_LABELS,
  formatCnpjRoot,
  formatDateTime,
  formatMoney,
  todayIso,
} from '../lib/format'
import { useLoad } from '../lib/useLoad'

type Tab = 'balances' | 'holders' | 'companies' | 'import'

/** Controle contábil, etapa 1: the monthly balance panel of the bank holders, and (administrator) its settings. */
export function ClosingPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('balances')
  const access = useLoad(() => closingApi.access(), [])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Controle contábil</h1>
          <div className="page-subtitle">Conferência mensal dos saldos dos portadores, por empresa</div>
        </div>
        {isAdmin && (
          <Segmented
            label="Seção"
            strong
            options={[
              { value: 'balances', label: 'Saldos' },
              { value: 'holders', label: 'Portadores' },
              { value: 'companies', label: 'Empresas e acesso' },
              { value: 'import', label: 'Importar CSV' },
            ]}
            value={tab}
            onChange={setTab}
          />
        )}
      </div>
      <ErrorBanner message={access.error} onRetry={access.reload} />
      {access.loading && !access.data && <Loading />}
      {access.data && tab === 'balances' && <BalancePanel firstCompetence={access.data.firstCompetence} />}
      {access.data && tab === 'holders' && <HoldersSection />}
      {access.data && tab === 'companies' && (
        <CompaniesSection accountingAccess={access.data.accountingAccess} onAccessChanged={access.reload} />
      )}
      {access.data && tab === 'import' && <ImportSection firstCompetence={access.data.firstCompetence} />}
    </>
  )
}

// ---------- balance panel ----------

/** `yyyy-MM` of the month before today (the month usually being closed), never before the first one. */
function defaultCompetence(first: string): string {
  const [year, month] = todayIso().split('-').map(Number)
  const previous = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
  return previous < first ? first : previous
}

const STATUS_ORDER: BalanceStatus[] = ['DIVERGENT', 'PENDING', 'OK', 'NO_MOVEMENT']
const OPEN_STATUSES = new Set<BalanceStatus>(['PENDING', 'DIVERGENT'])

function countByStatus(rows: HolderBalance[]): Record<BalanceStatus, number> {
  const counts: Record<BalanceStatus, number> = { PENDING: 0, DIVERGENT: 0, OK: 0, NO_MOVEMENT: 0 }
  rows.forEach((row) => counts[row.status]++)
  return counts
}

const COUNT_LABELS: Record<BalanceStatus, [string, string]> = {
  DIVERGENT: ['divergente', 'divergentes'],
  PENDING: ['pendente', 'pendentes'],
  OK: ['OK', 'OK'],
  NO_MOVEMENT: ['sem movimento', 'sem movimento'],
}

function countLabel(status: BalanceStatus, count: number): string {
  return `${count} ${COUNT_LABELS[status][count === 1 ? 0 : 1]}`
}

function StatusCounts({ rows }: { rows: HolderBalance[] }) {
  const counts = countByStatus(rows)
  return (
    <span className="closing-counts">
      {STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => (
        <span key={status} className={`badge ${BALANCE_STATUS_BADGES[status]}`}>
          {countLabel(status, counts[status])}
        </span>
      ))}
    </span>
  )
}

function BalancePanel({ firstCompetence }: { firstCompetence: string }) {
  const [competence, setCompetence] = useState(() => defaultCompetence(firstCompetence))
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [rows, setRows] = useState<HolderBalance[]>([])
  /** Rows edited on screen stay visible with "só pendentes" on, so a row doesn't vanish while being checked. */
  const [touched, setTouched] = useState<Set<number>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)

  const companies = useLoad(() => closingApi.activeCompanies(), [])
  const selectedCompany = companyId ?? companies.data?.[0]?.id ?? null
  const validCompetence = competence !== '' && competence >= firstCompetence && competence <= todayIso().slice(0, 7)
  const balances = useLoad(
    () => (selectedCompany && validCompetence ? closingApi.balances(selectedCompany, competence) : Promise.resolve([])),
    [selectedCompany, competence],
  )

  // A new load (another month or company) replaces the rows edited on screen.
  const [loaded, setLoaded] = useState(balances.data)
  if (balances.data !== loaded) {
    setLoaded(balances.data)
    if (balances.data) {
      setRows(balances.data)
      setTouched(new Set())
    }
  }

  async function save(row: HolderBalance, change: Partial<HolderBalance>) {
    if (!selectedCompany) return
    const next = { ...row, ...change }
    const replace = (value: HolderBalance) =>
      setRows((current) => current.map((item) => (item.holder.id === row.holder.id ? value : item)))
    // Shown at once; the server's answer brings the difference and the status, or the row goes back if refused.
    replace(next)
    setSaveError(null)
    try {
      const saved = await closingApi.saveBalance({
        holderId: row.holder.id,
        companyId: selectedCompany,
        competence,
        imported: next.imported,
        noMovement: next.noMovement,
        statementBalance: next.statementBalance,
        ledgerBalance: next.ledgerBalance,
        note: next.note?.trim() ? next.note.trim() : null,
      })
      replace(saved)
      setTouched((current) => new Set(current).add(row.holder.id))
    } catch (caught) {
      replace(row)
      setSaveError(`${row.holder.code}: ${errorMessage(caught)}`)
    }
  }

  const visible = onlyOpen ? rows.filter((row) => OPEN_STATUSES.has(row.status) || touched.has(row.holder.id)) : rows
  const groups: { type: HolderType; title: string }[] = [
    { type: 'CHECKING', title: 'Contas correntes' },
    { type: 'INVESTMENT', title: 'Aplicações' },
  ]

  return (
    <>
      <div className="card filters filters-closing">
        <Field label="Competência">
          <MonthInput value={competence} onChange={setCompetence} label="Competência" />
        </Field>
        <Field label="Empresa">
          <select value={selectedCompany ?? ''} onChange={(e) => setCompanyId(Number(e.target.value))}>
            {(companies.data ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="checkbox closing-only-open">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Só pendentes e divergentes
        </label>
      </div>
      {competence !== '' && !validCompetence && (
        <div className="banner banner-error">
          A competência vai de {firstCompetence.slice(5)}/{firstCompetence.slice(0, 4)} até o mês atual.
        </div>
      )}
      {companies.data?.length === 0 && (
        <div className="banner banner-error">
          Nenhuma empresa do fechamento está ativa. O Administrador as cadastra em "Empresas e acesso".
        </div>
      )}
      <ErrorBanner message={saveError ?? balances.error ?? companies.error} onRetry={balances.error ? balances.reload : undefined} />
      {balances.loading && rows.length === 0 && <Loading />}
      {rows.length > 0 && (
        <div className="closing-summary card">
          <div>
            <strong>{rows.length}</strong> {rows.length === 1 ? 'portador' : 'portadores'} no mês
          </div>
          <StatusCounts rows={rows} />
        </div>
      )}
      {!balances.loading && balances.data && rows.length === 0 && validCompetence && selectedCompany && (
        <p className="muted">Nenhum portador vinculado a esta empresa.</p>
      )}
      {groups.map((group) => {
        const all = rows.filter((row) => row.holder.type === group.type)
        if (all.length === 0) return null
        return (
          <BalanceGroup
            key={group.type}
            title={group.title}
            all={all}
            shown={visible.filter((row) => row.holder.type === group.type)}
            onSave={save}
          />
        )
      })}
    </>
  )
}

interface BalanceGroupProps {
  title: string
  all: HolderBalance[]
  shown: HolderBalance[]
  onSave: (row: HolderBalance, change: Partial<HolderBalance>) => void
}

function BalanceGroup({ title, all, shown, onSave }: BalanceGroupProps) {
  const [open, setOpen] = useState(true)
  return (
    <section className="card closing-group">
      <button type="button" className="closing-group-header" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="closing-group-caret" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <h2>{title}</h2>
        <span className="muted">{all.length}</span>
        <StatusCounts rows={all} />
      </button>
      {open && (
        <div className="table-wrapper">
          <table className="closing-table">
            <thead>
              <tr>
                <th>Portador</th>
                <th className="center">Importado</th>
                <th className="center">Sem mov.</th>
                <th className="number">Saldo extrato</th>
                <th className="number">Saldo contábil</th>
                <th className="number">Diferença</th>
                <th>Status</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <BalanceLine key={row.holder.id} row={row} onSave={onSave} />
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted empty-row">
                    Nada pendente ou divergente neste grupo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function BalanceLine({ row, onSave }: { row: HolderBalance; onSave: (row: HolderBalance, change: Partial<HolderBalance>) => void }) {
  const [note, setNote] = useState(row.note ?? '')
  const [lastNote, setLastNote] = useState(row.note)
  if (row.note !== lastNote) {
    setLastNote(row.note)
    setNote(row.note ?? '')
  }
  const { holder } = row
  // A holder created by the import is described by its bank and account; then they aren't repeated below.
  const details = [holder.bank, holder.account].filter(Boolean).join(' · ')
  const repeated = holder.description === [holder.bank, holder.account].filter(Boolean).join(' ')
  const disabled = row.noMovement

  return (
    <tr className={`closing-row closing-row-${row.status.toLowerCase()}`}>
      <td>
        <div className="closing-holder">
          <span className="closing-code">{holder.code}</span>
          <span>
            {holder.description}
            {details && !repeated && <span className="muted closing-holder-details">{details}</span>}
          </span>
        </div>
      </td>
      <td className="center">
        <input
          type="checkbox"
          aria-label={`${holder.code}: extrato importado`}
          checked={row.imported}
          disabled={disabled}
          onChange={(e) => onSave(row, { imported: e.target.checked })}
        />
      </td>
      <td className="center">
        <input
          type="checkbox"
          aria-label={`${holder.code}: sem movimento`}
          checked={row.noMovement}
          onChange={(e) => onSave(row, { noMovement: e.target.checked })}
        />
      </td>
      <td className="number">
        <SignedMoneyInput
          aria-label={`${holder.code}: saldo do extrato`}
          value={row.statementBalance}
          disabled={disabled}
          onCommit={(value) => onSave(row, { statementBalance: value })}
        />
      </td>
      <td className="number">
        <SignedMoneyInput
          aria-label={`${holder.code}: saldo contábil`}
          value={row.ledgerBalance}
          disabled={disabled}
          onCommit={(value) => onSave(row, { ledgerBalance: value })}
        />
      </td>
      <td className={`number nowrap${row.difference ? ' closing-difference' : ''}`}>
        {row.difference === null ? <span className="muted">—</span> : formatMoney(row.difference)}
      </td>
      <td>
        <span
          className={`badge ${BALANCE_STATUS_BADGES[row.status]}`}
          title={row.updatedBy && row.updatedAt ? `Alterado por ${row.updatedBy} em ${formatDateTime(row.updatedAt)}` : undefined}
        >
          {BALANCE_STATUS_LABELS[row.status]}
        </span>
      </td>
      <td>
        <input
          className="closing-note"
          aria-label={`${holder.code}: observação`}
          maxLength={500}
          value={note}
          placeholder="—"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note.trim() !== (row.note ?? '') && onSave(row, { note })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </td>
    </tr>
  )
}

// ---------- holders (administrator) ----------

function HoldersSection() {
  const holders = useLoad(() => closingApi.holders(), [])
  const companies = useLoad(() => closingApi.companyOptions(), [])
  const [editing, setEditing] = useState<BankHolder | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const closingCompanies = useMemo(
    () => (companies.data ?? []).filter((option) => option.id !== null) as (ClosingCompanyOption & { id: number })[],
    [companies.data],
  )
  const companyName = (id: number) => closingCompanies.find((company) => company.id === id)?.name ?? `#${id}`

  async function remove(holder: BankHolder) {
    if (!window.confirm(`Excluir o portador ${holder.code}?`)) return
    setError(null)
    try {
      await closingApi.deleteHolder(holder.id)
      holders.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <>
      <div className="closing-section-header">
        <p className="muted">
          Contas correntes e aplicações conferidas no fechamento. Os códigos seguem o sistema financeiro (C01, C1…);
          T01 e T02 são históricos de transferências e não entram aqui.
        </p>
        <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
          Novo portador
        </button>
      </div>
      <ErrorBanner message={error ?? holders.error ?? companies.error} onRetry={holders.error ? holders.reload : undefined} />
      {holders.loading && !holders.data && <Loading />}
      {holders.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Banco</th>
                <th>Conta</th>
                <th>Tipo</th>
                <th>Empresas</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {holders.data.map((holder) => (
                <tr key={holder.id}>
                  <td className="closing-code">{holder.code}</td>
                  <td>{holder.description}</td>
                  <td>{holder.bank ?? <span className="muted">—</span>}</td>
                  <td className="nowrap">{holder.account ?? <span className="muted">—</span>}</td>
                  <td className="nowrap">{HOLDER_TYPE_LABELS[holder.type]}</td>
                  <td>{holder.companyIds.map(companyName).join(', ') || <span className="muted">—</span>}</td>
                  <td>
                    <span className={`badge ${holder.active ? 'badge-paid' : 'badge-archived'}`}>
                      {holder.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <IconButton label={`Editar ${holder.code}`} onClick={() => setEditing(holder)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton label={`Excluir ${holder.code}`} onClick={() => remove(holder)} danger>
                      <DeleteIcon />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {holders.data.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted empty-row">
                    Nenhum portador cadastrado. Cadastre aqui ou importe um CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <HolderForm
          holder={editing === 'new' ? null : editing}
          companies={closingCompanies}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            holders.reload()
          }}
        />
      )}
    </>
  )
}

interface HolderFormProps {
  holder: BankHolder | null
  companies: { id: number; name: string | null }[]
  onClose: () => void
  onSaved: () => void
}

function HolderForm({ holder, companies, onClose, onSaved }: HolderFormProps) {
  const [form, setForm] = useState<BankHolderInput>(() => ({
    code: holder?.code ?? '',
    description: holder?.description ?? '',
    bank: holder?.bank ?? '',
    account: holder?.account ?? '',
    type: holder?.type ?? 'CHECKING',
    active: holder?.active ?? true,
    companyIds: holder?.companyIds ?? [],
  }))
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setErrors({})
    const input = { ...form, bank: form.bank?.trim() || null, account: form.account?.trim() || null }
    try {
      if (holder) await closingApi.updateHolder(holder.id, input)
      else await closingApi.createHolder(input)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
      setErrors(fieldErrors(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={holder ? `Editar portador ${holder.code}` : 'Novo portador'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <div className="form-row">
          <Field label="Código" error={errors.code} hint="Letras e números, como C07">
            <input
              required
              maxLength={7}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
            />
          </Field>
          <Field label="Tipo" group>
            <Segmented
              label="Tipo"
              options={[
                { value: 'CHECKING', label: 'Conta corrente' },
                { value: 'INVESTMENT', label: 'Aplicação' },
              ]}
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
            />
          </Field>
        </div>
        <Field label="Descrição" error={errors.description}>
          <input required maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Banco" error={errors.bank}>
            <input maxLength={100} value={form.bank ?? ''} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
          </Field>
          <Field label="Conta" error={errors.account}>
            <input maxLength={60} value={form.account ?? ''} onChange={(e) => setForm({ ...form, account: e.target.value })} />
          </Field>
        </div>
        <Field label="Empresas em que é conferido" group>
          <CheckboxList
            options={companies.map((company) => ({ value: String(company.id), label: company.name ?? '' }))}
            selected={form.companyIds.map(String)}
            onChange={(selected) => setForm({ ...form, companyIds: selected.map(Number) })}
            emptyText="Nenhuma empresa do fechamento cadastrada."
            selectAllText="Marcar todas"
            clearAllText="Desmarcar todas"
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Ativo (inativo sai do painel dos meses seguintes)
        </label>
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- closing companies and access (administrator) ----------

function CompaniesSection({ accountingAccess, onAccessChanged }: { accountingAccess: boolean; onAccessChanged: () => void }) {
  const options = useLoad(() => closingApi.companyOptions(), [])
  const [editing, setEditing] = useState<ClosingCompanyOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The choice shown at once, until the reloaded setting arrives. */
  const [pending, setPending] = useState<boolean | null>(null)
  const checked = pending ?? accountingAccess

  async function toggleAccess(enabled: boolean) {
    setError(null)
    setPending(enabled)
    try {
      await closingApi.setAccountingAccess(enabled)
      onAccessChanged()
    } catch (caught) {
      setError(errorMessage(caught))
      setPending(null)
    }
  }

  return (
    <>
      <div className="card closing-access">
        <label className="checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => toggleAccess(e.target.checked)} />
          Liberar o Controle contábil para o perfil Contábil
        </label>
        <p className="muted">
          O Contábil consulta e lança saldos; cadastros, importação e esta liberação continuam só com o Administrador.
          A mudança vale no próximo login de quem já está no sistema.
        </p>
      </div>
      <ErrorBanner message={error ?? options.error} onRetry={options.error ? options.reload : undefined} />
      <p className="muted">
        O fechamento é feito pela matriz: cada raiz de CNPJ do cadastro de empresas vira uma empresa do fechamento, com
        as filiais juntas. Dê um nome curto às que entram no controle.
      </p>
      {options.loading && !options.data && <Loading />}
      {options.data && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Raiz do CNPJ</th>
                <th>Matriz no cadastro</th>
                <th>Unidades</th>
                <th>Nome no fechamento</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {options.data.map((option) => (
                <tr key={option.cnpjRoot}>
                  <td className="nowrap">{formatCnpjRoot(option.cnpjRoot)}</td>
                  <td>{option.headOfficeName}</td>
                  <td>{option.unitCount}</td>
                  <td>{option.name ?? <span className="muted">fora do controle</span>}</td>
                  <td>
                    {option.id !== null && (
                      <span className={`badge ${option.active ? 'badge-paid' : 'badge-archived'}`}>
                        {option.active ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                  </td>
                  <td className="row-actions">
                    <IconButton label={`Editar ${option.headOfficeName}`} onClick={() => setEditing(option)}>
                      <EditIcon />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ClosingCompanyForm
          option={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            options.reload()
          }}
        />
      )}
    </>
  )
}

function ClosingCompanyForm({ option, onClose, onSaved }: { option: ClosingCompanyOption; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(option.name ?? '')
  const [active, setActive] = useState(option.id === null ? true : option.active)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await closingApi.saveCompany(option.cnpjRoot, name.trim(), active)
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Empresa do fechamento · ${formatCnpjRoot(option.cnpjRoot)}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorBanner message={error} />
        <p className="muted">
          Matriz no cadastro: {option.headOfficeName} ({option.unitCount} {option.unitCount === 1 ? 'unidade' : 'unidades'})
        </p>
        <Field label="Nome no fechamento" hint="Nome curto, usado no painel e no CSV de importação">
          <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativa no controle
        </label>
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- CSV import (administrator) ----------

function ImportSection({ firstCompetence }: { firstCompetence: string }) {
  const [competence, setCompetence] = useState(() => defaultCompetence(firstCompetence))
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    setReport(null)
    try {
      setReport(await closingApi.importCsv(competence, csv))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="closing-import">
      <form className="card form" onSubmit={submit}>
        <p className="muted">
          Uma linha por portador e empresa, separada por ponto e vírgula:{' '}
          <code>empresa;codigo_portador;banco;conta;importado;saldo_extrato;saldo_contabil;observacao</code>. A empresa é
          o nome no fechamento; importado é <code>sim</code> ou <code>nao</code>; valores como <code>1.234,56</code> ou{' '}
          <code>-0,02</code>. Portador novo é cadastrado como conta corrente. Se alguma linha tiver erro, nada é gravado.
        </p>
        <div className="form-row">
          <Field label="Competência">
            <MonthInput value={competence} onChange={setCompetence} required label="Competência" />
          </Field>
          <Field label="Arquivo CSV" hint={fileName ? undefined : 'Ou cole o conteúdo abaixo'}>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setFileName(file.name)
                setCsv(await file.text())
              }}
            />
          </Field>
        </div>
        <Field label="Conteúdo">
          <textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} spellCheck={false} className="closing-csv" />
        </Field>
        <ErrorBanner message={error} />
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={sending || !csv.trim() || !competence}>
            {sending ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </form>
      {report && (
        <div className="card closing-report" role="status">
          <h2>Importação concluída</h2>
          <ul>
            <li>
              {report.balancesSaved} {report.balancesSaved === 1 ? 'saldo gravado' : 'saldos gravados'} ({report.linesRead} linhas lidas)
            </li>
            <li>
              {report.holdersCreated.length === 0
                ? 'Nenhum portador novo'
                : `Portadores cadastrados: ${report.holdersCreated.join(', ')}`}
            </li>
            {report.ignored.map((line) => (
              <li key={line.line} className="muted">
                Linha {line.line} ignorada: {line.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

