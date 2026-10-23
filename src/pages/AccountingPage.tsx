import { NavLink, Outlet } from 'react-router-dom'

/** Accounting import module (administrator only): one tab per area. */
export function AccountingPage() {
  return (
    <>
      <div className="page-header">
        <h1>Contabilidade</h1>
      </div>
      <nav className="tabs" aria-label="Áreas da contabilidade">
        <NavLink to="/accounting/chart-accounts">Plano de contas</NavLink>
        <NavLink to="/accounting/suppliers">Fornecedores</NavLink>
        <NavLink to="/accounting/registries">Bases e conflitos</NavLink>
        <NavLink to="/accounting/audit">Registro de alterações</NavLink>
      </nav>
      <Outlet />
    </>
  )
}
