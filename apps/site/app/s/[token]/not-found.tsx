import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Link indisponível · Elaps',
  robots: { index: false, follow: false },
};

export default function ShareNotFound() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <span className="text-sm font-semibold text-slate-500">Elaps</span>
        <h1 className="text-2xl font-bold">Este link não existe ou foi revogado</h1>
        <p className="text-sm text-slate-500">
          Peça um link novo para quem compartilhou, ou conheça o Elaps.
        </p>
        <a
          href={appUrl}
          className="mt-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Conhecer o Elaps
        </a>
      </div>
    </main>
  );
}
