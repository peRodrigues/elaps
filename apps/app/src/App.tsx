import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/app-layout';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { GroupsPage } from '@/features/groups/groups-page';
import { SessionsPage } from '@/features/sessions/sessions-page';
import { TimerPage } from '@/features/timer/timer-page';
import { Toaster } from '@/components/ui/sonner';
import { RequireAuth } from '@/lib/auth-guard';
import { AuthProvider } from '@/lib/auth-provider';
import { CALLBACK_PATH } from '@/lib/auth';
import { LoginCallback } from '@/pages/login-callback';
import { LoginPage } from '@/pages/login-page';
import { SettingsPage } from '@/pages/settings-page';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="entrar" element={<LoginPage />} />
            <Route path={CALLBACK_PATH} element={<LoginCallback />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<TimerPage />} />
                <Route path="sessoes" element={<SessionsPage />} />
                <Route path="grupos" element={<GroupsPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="ajustes" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
