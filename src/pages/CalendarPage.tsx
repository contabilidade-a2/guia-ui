import { useState } from 'react'
import { Link } from 'react-router-dom'
import { calendarApi } from '../api/endpoints'
import { ErrorBanner, Loading, SlipStatusBadge } from '../components/ui'
import { MONTH_NAMES, WEEKDAY_NAMES, formatDate, formatMoney, toIsoDate, todayIso } from '../lib/format'
import { useLoad } from '../lib/useLoad'

export function CalendarPage() {
  const today = todayIso()
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)))
  const [selected, setSelected] = useState(today)

  const days = useLoad(() => calendarApi.month(year, month), [year, month])
  const dayGroups = useLoad(() => calendarApi.day(selected), [selected])

  const byDate = new Map((days.data ?? []).map((day) => [day.date, day]))
  const leadingBlanks = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  function goTo(newYear: number, newMonth: number) {
    // month 0 and 13 roll over to the neighbouring year
    const date = new Date(newYear, newMonth - 1, 1)
    setYear(date.getFullYear())
    setMonth(date.getMonth() + 1)
  }

  function goToToday() {
    goTo(Number(today.slice(0, 4)), Number(today.slice(5, 7)))
    setSelected(today)
  }

  return (
    <>
      <div className="page-header">
        <h1>Calendário de vencimentos</h1>
        <div className="calendar-nav">
          <button type="button" className="button" onClick={() => goTo(year, month - 1)} aria-label="Mês anterior">
            ‹
          </button>
          <select value={month} onChange={(e) => goTo(year, Number(e.target.value))} aria-label="Mês">
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="year-input"
            value={year}
            min={2000}
            max={2100}
            onChange={(e) => e.target.value && goTo(Number(e.target.value), month)}
            aria-label="Ano"
          />
          <button type="button" className="button" onClick={() => goTo(year, month + 1)} aria-label="Próximo mês">
            ›
          </button>
          <button type="button" className="button" onClick={goToToday}>
            Hoje
          </button>
        </div>
      </div>

      <ErrorBanner message={days.error} onRetry={days.reload} />

      <div className="calendar card">
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className="calendar-weekday">
            {name}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <div key={`blank-${index}`} className="calendar-cell calendar-blank" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = toIsoDate(year, month, index + 1)
          const info = byDate.get(date)
          const classes = ['calendar-cell']
          if (info) classes.push('calendar-has-slips')
          if (date === today) classes.push('calendar-today')
          if (date === selected) classes.push('calendar-selected')
          return (
            <button type="button" key={date} className={classes.join(' ')} onClick={() => setSelected(date)}>
              <span className="calendar-day-number">{index + 1}</span>
              {info && (
                <span className="calendar-counts">
                  {info.overdue > 0 && <span className="count count-overdue" title="Vencidas">{info.overdue}</span>}
                  {info.pending > 0 && <span className="count count-pending" title="Pendentes">{info.pending}</span>}
                  {info.paid > 0 && <span className="count count-paid" title="Pagas">{info.paid}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="legend">
        <span><span className="swatch count-overdue" /> Vencidas</span>
        <span><span className="swatch count-pending" /> Pendentes</span>
        <span><span className="swatch count-paid" /> Pagas</span>
      </div>

      <section className="day-section">
        <h2>Guias com vencimento em {formatDate(selected)}</h2>
        <ErrorBanner message={dayGroups.error} onRetry={dayGroups.reload} />
        {dayGroups.loading && !dayGroups.data && <Loading />}
        {dayGroups.data?.length === 0 && <p className="muted">Nenhuma guia vence neste dia.</p>}
        {dayGroups.data?.map((group) => (
          <div key={group.slipType.id} className="card day-group">
            <h3>{group.slipType.name}</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Assunto</th>
                    <th>Empresa</th>
                    <th className="numeric">Valor</th>
                    <th>Guia</th>
                    <th>Comprovante</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.slips.map((slip) => (
                    <tr key={slip.id}>
                      <td>
                        <Link to={`/slips/${slip.id}`}>{slip.subject}</Link>
                      </td>
                      <td>{slip.company.label}</td>
                      <td className="numeric">{formatMoney(slip.amount)}</td>
                      <td>
                        {slip.fileUrl ? (
                          <a href={slip.fileUrl} target="_blank" rel="noreferrer">
                            Abrir PDF
                          </a>
                        ) : (
                          <span className="muted">Indisponível</span>
                        )}
                      </td>
                      <td>
                        {slip.receiptUrl ? (
                          <a href={slip.receiptUrl} target="_blank" rel="noreferrer">
                            Abrir comprovante
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <SlipStatusBadge status={slip.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
