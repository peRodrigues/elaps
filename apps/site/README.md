# apps/site

Site público do Elaps (Next.js, App Router, Tailwind). Hoje serve:

- `/s/<token>`: página pública de um resumo compartilhado (o link que o app cria em
  Dashboard › Compartilhar › Criar link público), com imagem de prévia (Open Graph, 1200×630)
  para WhatsApp/X. Link inexistente ou revogado mostra um 404 amigável.
- `/`: placeholder com link para o app (a landing de verdade é outro card).

A página lê o retrato congelado pela RPC pública `get_share(token)` do Supabase, com a chave
publishable, e renderiza no servidor a partir do `SharePayloadV1` do `@elaps/core`. Nada é
escrito e nenhum dado pessoal sai do banco (a RPC não devolve user_id nem o token). As páginas de
compartilhamento são `noindex` e regeradas a cada 2 minutos (um link revogado some em poucos
minutos).

## Rodar localmente

1. Suba o Supabase local (`npm run db:start` na raiz).
2. Copie `apps/site/.env.example` para `apps/site/.env.local` e preencha a chave publishable
   (`npx supabase status`). O `.env.local` fica fora do git.
3. `npm run dev -w apps/site` e abra http://localhost:3000. Crie um link no app
   (http://localhost:5173 › Dashboard › Compartilhar) e abra `http://localhost:3000/s/<token>`.

Scripts: `npm run dev|build|start -w apps/site` (porta 3000).

## Deploy

Projeto **separado** do app na Vercel:

1. Importe o repositório com **Root Directory** `apps/site` (framework Next.js; deixe a opção de
   incluir arquivos fora do Root Directory ligada, porque o site usa o workspace
   `@elaps/core`). Instalação e build: os padrões (`npm install` / `next build`).
2. Variáveis de ambiente (Production e Preview):

   | Variável                               | Valor                                                |
   | -------------------------------------- | ---------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | URL do projeto Supabase de produção (`elaps-prod`)   |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publishable de produção (nunca a `sb_secret_`) |
   | `NEXT_PUBLIC_SITE_URL`                 | `https://<domínio do site>` (base do `og:image`)     |
   | `NEXT_PUBLIC_APP_URL`                  | URL do app (`https://app.<domínio>`)                 |

3. Domínio sugerido para os links: o domínio raiz do usuário (`https://<domínio>/s/<token>`),
   deixando o app em um subdomínio (`app.<domínio>`). No app, defina `VITE_SHARE_BASE_URL` com o
   domínio do site; a URL do link fica `<base>/s/<token>`.
4. A RPC `get_share` precisa existir no banco de produção (migração v2 aplicada).
