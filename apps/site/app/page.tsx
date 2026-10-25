// Placeholder: a landing de verdade é outro card.
export default function Home() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-5xl font-bold">Elaps</h1>
        <p className="text-slate-500">Registre o tempo que você dedica ao que importa.</p>
        <a
          href={appUrl}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Abrir o app
        </a>
      </div>
    </main>
  );
}
