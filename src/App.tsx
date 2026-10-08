import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { CalendarPage } from './pages/CalendarPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { DeletedSlipsPage } from './pages/DeletedSlipsPage'
import { InstallmentPlansPage } from './pages/InstallmentPlansPage'
import { LoginPage } from './pages/LoginPage'
import { PasswordPage } from './pages/PasswordPage'
import { SlipDetailPage } from './pages/SlipDetailPage'
import { SlipFormPage } from './pages/SlipFormPage'
import { SlipListPage } from './pages/SlipListPage'
import { SlipTypesPage } from './pages/SlipTypesPage'
import { UsersPage } from './pages/UsersPage'

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="centered">
        <Loading />
      </div>
    )
  }
  // Remember where the user was going (e.g. a link from an e-mail) to return there after login.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

function RequireCompanyManager() {
  const { canManageCompanies } = useAuth()
  return canManageCompanies ? <Outlet /> : <Navigate to="/" replace />
}

function RequireSlipEditor() {
  const { canEditSlips } = useAuth()
  return canEditSlips ? <Outlet /> : <Navigate to="/slips" replace />
}

function RequireInstallmentPlanManager() {
  const { canManageInstallmentPlans } = useAuth()
  return canManageInstallmentPlans ? <Outlet /> : <Navigate to="/" replace />
}

// HashRouter: GitHub Pages has no SPA fallback, so routes live after the `#`.
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<CalendarPage />} />
              <Route path="/slips" element={<SlipListPage />} />
              <Route element={<RequireInstallmentPlanManager />}>
                <Route path="/installment-plans" element={<InstallmentPlansPage />} />
              </Route>
              <Route element={<RequireSlipEditor />}>
                <Route path="/slips/new" element={<SlipFormPage />} />
                <Route path="/slips/:id/edit" element={<SlipFormPage />} />
              </Route>
              <Route path="/slips/:id" element={<SlipDetailPage />} />
              <Route path="/password" element={<PasswordPage />} />
              <Route element={<RequireCompanyManager />}>
                <Route path="/companies" element={<CompaniesPage />} />
              </Route>
              <Route element={<RequireAdmin />}>
                <Route path="/slip-types" element={<SlipTypesPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/deleted-slips" element={<DeletedSlipsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
