import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/app-layout';
import { PlaceholderPage } from '@/pages/placeholder-page';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<PlaceholderPage name="timer" />} />
            <Route path="sessoes" element={<PlaceholderPage name="sessions" />} />
            <Route path="grupos" element={<PlaceholderPage name="groups" />} />
            <Route path="dashboard" element={<PlaceholderPage name="dashboard" />} />
            <Route path="ajustes" element={<PlaceholderPage name="settings" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
