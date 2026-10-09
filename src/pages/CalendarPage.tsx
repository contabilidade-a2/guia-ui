import { useState } from 'react'
import { Link } from 'react-router-dom'
import { calendarApi } from '../api/endpoints'
import type { CalendarDay, SlipTypeGroup } from '../api/types'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons'
import { ErrorBanner, Loading, SlipStatusBadge } from '../components/ui'
import {
  MONTH_NAMES,
  WEEKDAY_FULL_NAMES,
  WEEKDAY_NAMES,
  formatDayMonth,
  formatMoney,
  toIsoDate,
  todayIso,
  weekdayOf,
} from '../lib/format'
import { useLoad } from '../lib/useLoad'

/** One numbered badge per status present in the day (overdue first), instead of one dot per slip. */
function badges(info: CalendarDay): { status: string; count: number }[] {
  return [
    { status: 'overdue', count: info.overdue },
    { status: 'pending', count: info.pending },
    { status: 'paid', count: info.paid },
  ].filter((badge) => badge.count > 0)
}

const FIRST_YEAR = 2000
const LAST_YEAR = 2100

function slipCount(count: number): string {
  return count === 1 ? '1 guia' : `${count} guias`
}

export function CalendarPage() {
  const today = todayIso()
  const [year, setYear] = useState(() => Number(today.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)))
  const [selected, setSelected] = useState(today)
  // The year is typed freely and only applied once it is a complete, valid year.
  const [yearText, setYearText] = useState(String(year))

  const days = useLoad(() => calendarApi.month(year, month), [year, month])
  const dayGroups = useLoad(() => calendarApi.day(selected), [selected])

  const byDate = new Map((days.data ?? []).map((day) => [day.date, day]))
  const leadingBlanks = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  // Blank cells after the last day too, so the grid lines close the last week.
  const trailingBlanks = (7 - ((leadingBlanks + daysInMonth) % 7)) % 7

  function goTo(newYear: number, newMonth: number) {
    // month 0 and 13 roll over to the neighbouring year
    const date = new Date(newYear, newMonth - 1, 1)
    setYear(date.getFullYear())
    setMonth(date.getMonth() + 1)
    setYearText(String(date.getFullYear()))
  }

  function typeYear(text: string) {
    setYearText(text)
    const typed = Number(text)
    if (/^\d{4}$/.test(text) && typed >= FIRST_YEAR && typed <= LAST_YEAR) setYear(typed)
  }

  function goToToday() {
    goTo(Number(today.slice(0, 4)), Number(today.slice(5, 7)))
    setSelected(today)
  }

  return (
    <>
      <div className="page-header">
        <div className="title-line">
          <h1>
            {MONTH_NAMES[month - 1]} <span className="muted">{year}</span>
          </h1>
          <div className="calendar-nav">
            <button type="button" className="button button-icon" onClick={() => goTo(year, month - 1)} aria-label="Mês anterior">
              <ChevronLeftIcon />
            </button>
            <select
              className="month-select"
              value={month}
              onChange={(e) => goTo(year, Number(e.target.value))}
              aria-label="Mês"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
            <input
              className="year-input"
              type="number"
              min={FIRST_YEAR}
              max={LAST_YEAR}
              value={yearText}
              onChange={(e) => typeYear(e.target.value)}
              onBlur={() => setYearText(String(year))}
              aria-label="Ano"
            />
            <button type="button" className="button button-icon" onClick={() => goTo(year, month + 1)} aria-label="Próximo mês">
              <ChevronRightIcon />
            </button>
            <button type="button" className="button" onClick={goToToday}>
              Hoje
            </button>
          </div>
        </div>
      </div>

      <ErrorBanner message={days.error} onRetry={days.reload} />

      <div className="calendar-layout">
        <section className="calendar-main" aria-label="Calendário de vencimentos">
          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAY_NAMES.map((name) => (
              <div key={name} className="calendar-weekday">
                {name}
              </div>
            ))}
          </div>
          <div className="calendar">
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <div key={`lead-${index}`} className="calendar-cell calendar-blank" />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const date = toIsoDate(year, month, index + 1)
              const info = byDate.get(date)
              const classes = ['calendar-cell']
              if (date === today) classes.push('calendar-today')
              if (date === selected) classes.push('calendar-selected')
              const label = `${index + 1} de ${MONTH_NAMES[month - 1].toLowerCase()}${info ? `, ${slipCount(info.total)}` : ''}`
              return (
                <button
                  type="button"
                  key={date}
                  className={classes.join(' ')}
                  onClick={() => setSelected(date)}
                  aria-label={label}
                  aria-pressed={date === selected}
                >
                  <span className="calendar-day-number">{index + 1}</span>
                  {info && (
                    <span className="calendar-badges">
                      {badges(info).map((badge) => (
                        <span key={badge.status} className={`count-badge dot-${badge.status}`}>
                          {badge.count}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
            {Array.from({ length: trailingBlanks }, (_, index) => (
              <div key={`trail-${index}`} className="calendar-cell calendar-blank" />
            ))}
          </div>
          <div className="legend">
            <span>
              <span className="swatch dot-pending" /> Pendente
            </span>
            <span>
              <span className="swatch dot-overdue" /> Vencida
            </span>
            <span>
              <span className="swatch dot-paid" /> Paga
            </span>
          </div>
        </section>

        <aside className="card day-panel" aria-live="polite">
          <div className="day-panel-weekday">{WEEKDAY_FULL_NAMES[weekdayOf(selected)]}</div>
          <h2>{formatDayMonth(selected)}</h2>
          <DaySummary groups={dayGroups.data} />
          <ErrorBanner message={dayGroups.error} onRetry={dayGroups.reload} />
          {dayGroups.loading && !dayGroups.data && <Loading />}
          {dayGroups.data?.length === 0 && <p className="muted day-panel-empty">Nenhuma guia vence neste dia.</p>}
          {dayGroups.data?.map((group) => (
            <div key={group.slipType.id} className="day-group">
              <h3 className="section-title">{group.slipType.name}</h3>
              {group.slips.map((slip) => (
                <div key={slip.id} className="day-slip">
                  <div className="day-slip-body">
                    <Link to={`/slips/${slip.id}`} className="plain-link cell-title">
                      {slip.subject}
                    </Link>
                    <div className="cell-sub">
                      {slip.company.name} · {formatMoney(slip.amount)}
                    </div>
                    <div className="day-slip-links">
                      {slip.fileUrl ? (
                        <a href={slip.fileUrl} target="_blank" rel="noreferrer">
                          Ver guia
                        </a>
                      ) : (
                        <span className="muted">Guia indisponível</span>
                      )}
                      {slip.receiptUrl && (
                        <a href={slip.receiptUrl} target="_blank" rel="noreferrer">
                          Comprovante
                        </a>
                      )}
                    </div>
                  </div>
                  <SlipStatusBadge status={slip.status} />
                </div>
              ))}
            </div>
          ))}
        </aside>
      </div>
    </>
  )
}

/** `3 guias · R$ 18.430,55`, under the selected date. */
function DaySummary({ groups }: { groups: SlipTypeGroup[] | null }) {
  if (!groups) return <div className="day-panel-summary">&nbsp;</div>
  const slips = groups.flatMap((group) => group.slips)
  const total = slips.reduce((sum, slip) => sum + slip.amount, 0)
  if (slips.length === 0) return null
  return (
    <div className="day-panel-summary">
      {slipCount(slips.length)} · {formatMoney(total)}
    </div>
  )
}
