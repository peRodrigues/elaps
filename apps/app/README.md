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
   | `VITE_SUPABASE_URL`             | `API URL` (`http://127.0.0.1:54321`)             |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `Publishable key` (começa com `sb_publishable_`) |

   O `.env.local` fica fora do git. Nunca use ali a chave secreta (`sb_secret_…`).

3. Rode o app: `npm run dev` na raiz e abra http://localhost:5173.

## Entrar localmente

- Usuário do seed: `dev@elaps.local` (dados de exemplo de 14 dias).
- Peça o link de acesso em `/entrar`. O e-mail não sai da máquina: abra o Mailpit em
  http://127.0.0.1:54324 e clique no link **no mesmo navegador** em que pediu (o fluxo PKCE
  guarda a chave de verificação nele).
- O botão do Google só funciona depois de configurar as credenciais
  (`supabase/config.toml`, seção `[auth.external.google]`); até lá ele avisa que não está
  configurado.

## Deploy

Produção: app na Vercel e banco no projeto Supabase `elaps-prod`.

1. **Vercel.** Importe o repositório com **Root Directory** `apps/app`. O
   `apps/app/vercel.json` já define instalação e build a partir da raiz do monorepo, a
   saída `dist`, o fallback de SPA e os cabeçalhos de cache e segurança.
2. **Variáveis de ambiente** (Vercel → Settings → Environment Variables), com os valores
   do `elaps-prod` (Supabase → Project Settings → API Keys):

   | Variável                        | Valor                                                      |
   | ------------------------------- | ---------------------------------------------------------- |
   | `VITE_SUPABASE_URL`             | URL do projeto (`https://<ref>.supabase.co`)               |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`), nunca a `sb_secret_` |

   As `VITE_*` entram no bundle na hora do build: depois de mudar uma, faça um novo deploy.

3. **Banco.** Na raiz do repositório, ligue o CLI ao projeto e aplique as migrations:

   ```sh
   npx supabase link --project-ref <ref-do-elaps-prod>
   npx supabase db push
   ```

   O `seed.sql` é só para desenvolvimento e não vai para produção.

4. **Modelos de e-mail.** O `config.toml` só vale para o Supabase local. No `elaps-prod`,
   em Authentication → Emails, cole o conteúdo de `supabase/templates/magic_link.html`
   (Magic Link) e `supabase/templates/confirmation.html` (Confirm signup), com os mesmos
   assuntos definidos em `supabase/config.toml`.
5. **URLs de autenticação** (Authentication → URL Configuration), com o domínio da Vercel:
   - **Site URL:** `https://<dominio>`
   - **Redirect URLs:** `https://<dominio>/auth/callback` (e `https://<dominio>/**` se
     quiser aceitar previews no mesmo domínio).

   Com o Google ativo, a URL de callback do Supabase (`https://<ref>.supabase.co/auth/v1/callback`)
   também precisa estar nas credenciais OAuth do Google Cloud.
