import { Fragment, useState } from 'react'
import type { PlanLimits } from '../api/types'
import { usageApi } from '../api/endpoints'
import { MonthInput } from '../components/MonthInput'
import { ErrorBanner, Field, Loading } from '../components/ui'
import { formatDate, formatDuration, todayIso } from '../lib/format'
import { useLoad } from '../lib/useLoad'

function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function duration(millis: number | null): string {
  return millis === null ? '–' : formatDuration(millis)
}

/** Usage metrics of a month (administrator only), collected to decide about the hosting. */
export function UsagePage() {
  const [month, setMonth] = useState(() => todayIso().slice(0, 7))
  // An incomplete month (still being typed) keeps the last one on screen.
  const usage = useLoad(() => usageApi.summary(month), [month])
  const summary = usage.data

  return (
    <>
      <div className="page-header">
        <h1>Uso do sistema</h1>
        <Field label="Mês">
          <MonthInput value={month} onChange={(value) => value && setMonth(value)} />
        </Field>
      </div>
      <LimitsSection />
      <ErrorBanner message={usage.error} onRetry={usage.reload} />
      {usage.loading && !summary && <Loading />}
      {summary && (
        <>
          <div className="usage-tiles">
            <Tile label="Dias com uso" value={String(summary.daysWithUse)} hint={`${count(summary.distinctUsers, 'usuário', 'usuários')}, ${count(summary.totalCalls, 'chamada', 'chamadas')}`} />
            <Tile
              label="Vezes que acordou"
              value={String(summary.startups)}
              hint={`subida: média ${duration(summary.averageStartupMillis)}, máxima ${duration(summary.maxStartupMillis)}`}
            />
            <Tile label="Espera média" value={duration(summary.averageWaitMillis)} hint={count(summary.waits, 'medição', 'medições')} />
            <Tile label="Espera máxima" value={duration(summary.maxWaitMillis)} />
            <Tile
              label="Esperas de 10 s ou mais"
              value={String(summary.longWaits)}
              hint={`média ${duration(summary.averageLongWaitMillis)}`}
            />
          </div>

          <div className="usage-tables">
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Horário de pico</th>
                    <th>Chamadas</th>
                    <th>Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.peakHours.map((peak) => (
                    <tr key={peak.hour}>
                      <td>
                        {peak.hour}h às {peak.hour + 1}h
                      </td>
                      <td>{peak.calls}</td>
                      <td>{peak.days}</td>
                    </tr>
                  ))}
                  {summary.peakHours.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted empty-row">
                        Nenhuma chamada registrada neste mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <LastWeek />
          </div>
        </>
      )}
    </>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card usage-tile">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  )
}

/** Names of the database tables as the user knows them; others show their technical name. */
const TABLE_LABELS: Record<string, string> = {
  tax_slip: 'Guias',
  slip_history: 'Histórico das guias',
  slip_file: 'Links da guia e do comprovante',
  deleted_slip: 'Guias excluídas',
  sent_notification: 'Registro de e-mails enviados',
  usage_hour: 'Métricas: chamadas por hora',
  call_wait: 'Métricas: esperas',
  service_startup: 'Métricas: inicializações',
  company: 'Empresas',
  app_user: 'Usuários',
  user_company: 'Usuários notificados',
  installment_plan: 'Parcelamentos',
  slip_type: 'Tipos de guia',
  flyway_schema_history: 'Versões do banco',
}

/** `12345678` → `12,3 MB` (decimal units, as the hosting plans state their limits). */
function bytes(value: number): string {
  const units = ['B', 'kB', 'MB', 'GB']
  let amount = value
  let unit = 0
  while (amount >= 1000 && unit < units.length - 1) {
    amount /= 1000
    unit++
  }
  return `${amount.toLocaleString('pt-BR', { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, (part / whole) * 100) : 0
}

/** Green up to 70%, then amber, and red from 90%: time to act before the plan blocks something. */
function Meter({ value, label }: { value: number; label: string }) {
  const level = value >= 90 ? 'meter-high' : value >= 70 ? 'meter-mid' : ''
  return (
    <div className={`meter ${level}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <span style={{ width: `${value}%` }} />
    </div>
  )
}

/**
 * The free plans' limits (asked by the user on 25/11/2026): e-mails left today, as Brevo reports them, and the
 * database size against Neon's storage. Current values, whatever month is chosen below.
 */
function LimitsSection() {
  const limits = useLoad(() => usageApi.limits(), [])
  const data: PlanLimits | null = limits.data
  const checkedAt = data ? new Date(data.checkedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''

  return (
    <section className="limits">
      <div className="limits-header">
        <h2 className="section-title">Limites dos planos gratuitos</h2>
        {data && <span className="muted small">consultado às {checkedAt}</span>}
        <button type="button" className="link-button" onClick={limits.reload} disabled={limits.loading}>
          Atualizar
        </button>
      </div>
      <ErrorBanner message={limits.error} onRetry={limits.reload} />
      {data && (
        <div className="limits-grid">
          <div className="card limit-card">
            <span className="muted small">E-mails enviados hoje · Brevo</span>
            {data.email.remainingToday === null ? (
              <p className="muted small">{data.email.unavailableReason}</p>
            ) : (
              <>
                <strong>
                  {Math.max(0, data.email.dailyLimit - data.email.remainingToday)} de {data.email.dailyLimit}
                </strong>
                <Meter
                  value={percent(data.email.dailyLimit - data.email.remainingToday, data.email.dailyLimit)}
                  label="E-mails usados hoje"
                />
                <span className="muted small">
                  Restam {data.email.remainingToday} envios hoje, segundo o Brevo. Cada destinatário conta como um envio.
                </span>
              </>
            )}
          </div>
          <div className="card limit-card">
            <span className="muted small">Banco de dados · Neon</span>
            {data.database.sizeBytes === null ? (
              <p className="muted small">{data.database.unavailableReason}</p>
            ) : (
              <>
                <strong>
                  {bytes(data.database.sizeBytes)} de {bytes(data.database.limitBytes)}
                </strong>
                <Meter value={percent(data.database.sizeBytes, data.database.limitBytes)} label="Espaço do banco usado" />
                <span className="muted small">
                  {percent(data.database.sizeBytes, data.database.limitBytes).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% usado.
                  Valor aproximado; o oficial fica no painel do Neon.
                </span>
                {data.database.largestTables.length > 0 && (
                  <ul className="limit-tables">
                    {data.database.largestTables.map((table) => (
                      <li key={table.name}>
                        <span>{TABLE_LABELS[table.name] ?? table.name}</span>
                        <span className="muted">{bytes(table.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * The last seven days, whatever the month above (asked by the user on 26/11/2026): a click on the number of users
 * opens who used the system that day, with their calls and the hours of use.
 */
function LastWeek() {
  const week = useLoad(() => usageApi.lastWeek(), [])
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="card table-wrapper">
      <ErrorBanner message={week.error} onRetry={week.reload} />
      {week.loading && !week.data && <Loading />}
      {week.data && (
        <table className="usage-week">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Chamadas</th>
              <th>Usuários</th>
              <th>Acordou</th>
            </tr>
          </thead>
          <tbody>
            {week.data.map((day) => (
              <Fragment key={day.date}>
                <tr>
                  <td>{formatDate(day.date)}</td>
                  <td>{day.calls}</td>
                  <td>
                    {day.users.length > 0 ? (
                      <button
                        type="button"
                        className="link-button usage-users-button"
                        aria-expanded={open === day.date}
                        onClick={() => setOpen(open === day.date ? null : day.date)}
                      >
                        {day.users.length} {open === day.date ? '▴' : '▾'}
                      </button>
                    ) : (
                      0
                    )}
                  </td>
                  <td>{day.startups}</td>
                </tr>
                {open === day.date && (
                  <tr className="usage-users-row">
                    <td colSpan={4}>
                      <ul className="usage-users">
                        {day.users.map((user) => (
                          <li key={user.name}>
                            <strong>{user.name}</strong>
                            <span className="muted">
                              {user.calls} {user.calls === 1 ? 'chamada' : 'chamadas'} ·{' '}
                              {user.firstHour === user.lastHour
                                ? `${user.firstHour}h`
                                : `das ${user.firstHour}h às ${user.lastHour + 1}h`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
