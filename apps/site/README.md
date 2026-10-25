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

Projeto separado do app na Vercel, em https://share.elaps.ternal.com.br (os links ficam
`/s/<token>`): siga o [guia de produção](../../docs/DEPLOY.md), passo 5. O
`apps/site/vercel.json` instala e builda a partir da raiz do monorepo (o site usa
`@elaps/core`). A RPC `get_share` vem das migrações aplicadas no passo 2.
