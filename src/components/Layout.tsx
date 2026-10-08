import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../lib/format'
import { BrandIcon } from './icons'

export function Layout() {
  const { user, isAdmin, canManageCompanies, canManageInstallmentPlans, logout } = useAuth()
  if (!user) return null

  return (
    <div className="app">
      <header className="topbar">
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
        <div className="topbar-user">
          <span className="topbar-name">
            {user.name} <small>({ROLE_LABELS[user.role]})</small>
          </span>
          <NavLink to="/password">Alterar senha</NavLink>
          <button type="button" className="link-button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
