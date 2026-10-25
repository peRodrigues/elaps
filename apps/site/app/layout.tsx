import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Fontes self-hosted (sem Google Fonts): Inter no texto, Poppins nos títulos e
// números de destaque, JetBrains Mono nas durações.
import '@fontsource-variable/inter';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Elaps',
  description: 'Registre e acompanhe o tempo que você dedica ao que importa.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
