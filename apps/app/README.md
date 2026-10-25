# apps/app

App web do Elaps (Vite + React). Fala com o Supabase local durante o desenvolvimento.

## Configurar o Supabase

1. Na raiz do repositório, suba o Supabase local (precisa do Docker):

   ```sh
   npm run db:start
   ```

2. Copie `apps/app/.env.example` para `apps/app/.env.local` e preencha com a saída de
   `npx supabase status`:

   | Variável                        | Linha do `supabase status`                       |
   | ------------------------------- | ------------------------------------------------ |
   | `VITE_SUPABASE_URL`             | `API URL` (`http://127.0.0.1:55321`)             |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `Publishable key` (começa com `sb_publishable_`) |

   O `.env.local` fica fora do git. Nunca use ali a chave secreta (`sb_secret_…`).

   `VITE_SHARE_BASE_URL` (opcional, padrão `http://localhost:3000`) é o site que mostra os
   links públicos do botão Compartilhar do Dashboard: a URL é `<base>/s/<token>`.

3. Rode o app: `npm run dev` na raiz e abra http://localhost:5173.

## Entrar localmente

- Usuário do seed: `dev@elaps.local` (dados de exemplo de 14 dias).
- Peça o link de acesso em `/entrar`. O e-mail não sai da máquina: abra o Mailpit em
  http://127.0.0.1:55324 e clique no link **no mesmo navegador** em que pediu (o fluxo PKCE
  guarda a chave de verificação nele).
- O botão do Google só funciona depois de configurar as credenciais
  (`supabase/config.toml`, seção `[auth.external.google]`); até lá ele avisa que não está
  configurado.

## Deploy

Produção (app em https://elaps.ternal.com.br, Supabase `elaps-prod`, SMTP, Google e DNS): siga
o [guia de produção](../../docs/DEPLOY.md). O `apps/app/vercel.json` já traz instalação e build a
partir da raiz do monorepo, o fallback de SPA e os cabeçalhos.
