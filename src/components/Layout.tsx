import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../lib/format'
import { currentTheme, saveTheme } from '../lib/theme'
import type { Theme } from '../lib/theme'
import { BrandIcon } from './icons'

/** `Maria da Silva` → `MS`: first and last name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

interface MenuItem {
  label: string
  /** Absent for a screen still to come: shown as "em breve", not a link. */
  to?: string
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

/**
 * The menu (layout chosen by the user on 25/11/2026; order Guias, Contábil, Cadastros, Administração since 26/11/2026):
 * the calendar alone, then the screens grouped. Each profile sees
 * only its screens; a group left empty is hidden, and a group with a single screen becomes a plain link.
 */
interface MenuAccess {
  isAdmin: boolean
  canManageCompanies: boolean
  canManageInstallmentPlans: boolean
  canUseClosing: boolean
  isAccounting: boolean
}

function menuGroups(access: MenuAccess): MenuGroup[] {
  const { isAdmin, canManageCompanies, canManageInstallmentPlans, canUseClosing, isAccounting } = access
  const groups: MenuGroup[] = [
    {
      label: 'Guias',
      items: [{ label: 'Guias', to: '/slips' }, ...(canManageInstallmentPlans ? [{ label: 'Parcelamentos', to: '/installment-plans' }] : [])],
    },
    // Importação contábil is still to come. Controle contábil is a link for whoever may use it; Accounting, until the
    // administrator allows it, sees both as "em breve", just to know they are on the way (asked on 26/11/2026).
    {
      label: 'Contábil',
      items: [
        ...(isAdmin || isAccounting ? [{ label: 'Importação contábil' }] : []),
        ...(canUseClosing
          ? [{ label: 'Controle contábil', to: '/closing' }]
          : isAccounting
            ? [{ label: 'Controle contábil' }]
            : []),
      ],
    },
    {
      label: 'Cadastros',
      items: [
        ...(canManageCompanies ? [{ label: 'Empresas', to: '/companies' }] : []),
        ...(isAdmin ? [{ label: 'Tipos de guia', to: '/slip-types' }, { label: 'Usuários', to: '/users' }] : []),
      ],
    },
    {
      label: 'Administração',
      items: isAdmin ? [{ label: 'Guias excluídas', to: '/deleted-slips' }, { label: 'Uso', to: '/usage' }] : [],
    },
  ]
  return groups.filter((group) => group.items.length > 0)
}

function MainNav({ groups }: { groups: MenuGroup[] }) {
  return (
    <nav className="nav">
      <NavLink to="/" end>
        Calendário
      </NavLink>
      {groups.map((group) =>
        group.items.length === 1 && group.items[0].to ? (
          <NavLink key={group.label} to={group.items[0].to}>
            {group.items[0].label}
          </NavLink>
        ) : (
          <NavGroup key={group.label} group={group} />
        ),
      )}
    </nav>
  )
}

/** A group of the menu: a click opens its screens; it is underlined while one of them is open. */
function NavGroup({ group }: { group: MenuGroup }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const current = group.items.some((item) => item.to && (pathname === item.to || pathname.startsWith(`${item.to}/`)))

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
    <div className="nav-group" ref={ref}>
      <button
        type="button"
        className={`nav-group-button${current ? ' active' : ''}${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {group.label}
        <span className="nav-group-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="nav-menu">
          {group.items.map((item) =>
            item.to ? (
              <NavLink key={item.label} to={item.to}>
                {item.label}
              </NavLink>
            ) : (
              <span key={item.label} className="nav-menu-soon" aria-disabled="true">
                {item.label}
                <span className="soon-badge">em breve</span>
              </span>
            ),
          )}
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const { user, isAdmin, canManageCompanies, canManageInstallmentPlans, canUseClosing, logout } = useAuth()
  const isAccounting = user?.role === 'ACCOUNTING'
  const location = useLocation()
  if (!user) return null

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" title="Ir para o calendário">
            <BrandIcon />
            Sistema Contábil
          </Link>
          {/* keyed by the route, like the user menu: a group's menu closes on any navigation */}
          <MainNav key={`nav:${location.pathname}`} groups={menuGroups({ isAdmin, canManageCompanies, canManageInstallmentPlans, canUseClosing, isAccounting })} />
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
  const [theme, setTheme] = useState<Theme>(currentTheme)
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
          {/* the menu stays open, so the change is seen right away */}
          <button
            type="button"
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark'
              saveTheme(next)
              setTheme(next)
            }}
          >
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button type="button" onClick={onLogout}>
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
