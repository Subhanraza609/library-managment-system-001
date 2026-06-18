import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import DashboardPage from './features/dashboard/DashboardPage'
import ForbiddenPage from './features/misc/ForbiddenPage'
import NotFoundPage from './features/misc/NotFoundPage'
import { routes as membersRoutes } from './features/members/routes'
import { routes as catalogRoutes } from './features/catalog/routes'
import { routes as loansRoutes } from './features/loans/routes'
import { routes as finesRoutes } from './features/fines/routes'
import { routes as reportsRoutes } from './features/reports/routes'
import { routes as notificationsRoutes } from './features/notifications/routes'

// Each feature owns its routes in features/<name>/routes.jsx and is spread in below,
// so Phase 1 agents never edit this file — keeping parallel branches conflict-free.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/403', element: <ForbiddenPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      ...membersRoutes,
      ...catalogRoutes,
      ...loansRoutes,
      ...finesRoutes,
      ...reportsRoutes,
      ...notificationsRoutes,
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
