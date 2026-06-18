import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import { ThemeProvider } from './lib/theme'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './components/ui/Toast'
import { router } from './router'

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
