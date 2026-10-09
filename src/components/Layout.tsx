import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../lib/format'
import { BrandIcon } from './icons'

/** `Maria da Silva` → `MS`: first and last name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function Layout() {
  const { user, isAdmin, canManageCompanies, canManageInstallmentPlans, logout } = useAuth()
  const location = useLocation()
  if (!user) return null

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" title="Ir para o calendário">
            <BrandIcon />
            Sistema de Guias
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Calendário
            </NavLink>
            <NavLink to="/slips">Guias</NavLink>
            {canManageInstallmentPlans && <NavLink to="/installment-plans">Parcelamentos</NavLink>}
            {canManageCompanies && <NavLink to="/companies">Empresas</NavLink>}
            {isAdmin && (
              <>
                <NavLink to="/slip-types">Tipos de guia</NavLink>
                <NavLink to="/users">Usuários</NavLink>
                <NavLink to="/deleted-slips">Guias excluídas</NavLink>
              </>
            )}
          </nav>
          {/* keyed by the route so the menu closes on any navigation, the back button included */}
          <UserMenu key={location.pathname} name={user.name} role={ROLE_LABELS[user.role]} onLogout={logout} />
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

/** The user's name; a click opens "Alterar senha" and "Sair", which keeps the top bar on one line. */
function UserMenu({ name, role, onLogout }: { name: string; role: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="topbar-user" ref={ref}>
      <button type="button" className="user-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <span>
          {name} · {role}
        </span>
        <span className="user-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="user-menu">
          <NavLink to="/password" onClick={() => setOpen(false)}>
            Alterar senha
          </NavLink>
          <button type="button" onClick={onLogout}>
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
