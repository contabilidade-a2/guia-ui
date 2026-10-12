import { useState } from 'react'
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
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Chamadas</th>
                    <th>Usuários</th>
                    <th>Acordou</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.days.map((day) => (
                    <tr key={day.date}>
                      <td>{formatDate(day.date)}</td>
                      <td>{day.calls}</td>
                      <td>{day.users}</td>
                      <td>{day.startups}</td>
                    </tr>
                  ))}
                  {summary.days.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted empty-row">
                        Nenhum uso registrado neste mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
