# Elaps em produção: elaps.ternal.com.br

Passo a passo do zero ao ar. Siga na ordem: cada etapa usa valores copiados das anteriores.

| Peça                      | Onde                                       | Endereço                                    |
| ------------------------- | ------------------------------------------ | ------------------------------------------- |
| App (`apps/app`, SPA/PWA) | Vercel, projeto `elaps`                    | https://elaps.ternal.com.br                 |
| Site de compartilhamento  | Vercel, projeto `elaps-share`              | https://share.elaps.ternal.com.br/s/<token> |
| Banco, login e e-mail     | Supabase, projeto `elaps-prod` (São Paulo) | `https://<Project ref>.supabase.co`         |
| Envio de e-mail (SMTP)    | Resend, domínio `ternal.com.br`            | remetente `nao-responda@ternal.com.br`      |
| Login com Google          | Google Cloud, projeto `Elaps`              | —                                           |
| DNS                       | Registro.br (zona de `ternal.com.br`)      | —                                           |

## Valores que você vai copiar

Anote num gerenciador de senhas à medida que aparecem. A coluna "Vai para" diz o único lugar
onde cada um é colado.

| Nome                        | Onde aparece                                                         | Vai para                                        | Público? |
| --------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- | -------- |
| **Project ref**             | Supabase › Project Settings › General (20 letras)                    | `supabase link`, Google (callback), URLs abaixo | sim      |
| **Project URL**             | Supabase › Project Settings › Data API (`https://<ref>.supabase.co`) | Vercel app e site                               | sim      |
| **Publishable key**         | Supabase › Project Settings › API Keys (`sb_publishable_…`)          | Vercel app e site                               | sim      |
| **Database password**       | você cria ao criar o projeto                                         | só `supabase link` (no seu terminal)            | **NÃO**  |
| **Resend API key** (`re_…`) | Resend › API Keys                                                    | Supabase › SMTP (campo senha)                   | **NÃO**  |
| **Google Client ID**        | Google Cloud › Clients                                               | Supabase › Providers › Google                   | sim      |
| **Google Client secret**    | Google Cloud › Clients                                               | Supabase › Providers › Google                   | **NÃO**  |
| **Destino CNAME da Vercel** | Vercel › Settings › Domains (de cada projeto)                        | Registro.br (DNS)                               | sim      |

**Nunca vai para o front** (Vercel, `.env*` do app/site, código, git): a **secret key**
(`sb_secret_…`) e a antiga **service_role**, a **senha do banco** e a connection string, o
**Google Client secret**, a **Resend API key** e o access token do `supabase login`. O app e o
site só precisam da Project URL e da Publishable key: o banco se protege com RLS.

## 0. Pré-requisitos

- Conta na **Vercel** ligada ao GitHub com acesso ao repositório `peRodrigues/elaps`.
- Conta no **Supabase** (o plano grátis serve para começar) e no **Resend**.
- Conta Google para o **Google Cloud Console**.
- Acesso ao painel do **Registro.br** de `ternal.com.br`. O DNS do domínio está no Registro.br
  (servidores `a.auto.dns.br` e `b.auto.dns.br`). Para conferir de novo, rode
  `nslookup -type=NS ternal.com.br`: `*.dns.br` = Registro.br, `*.ns.cloudflare.com` =
  Cloudflare (as duas variações estão no passo 7).
- Na sua máquina: o repositório clonado e `npm ci` na raiz (Node 24, o mesmo da Vercel).

## 1. Supabase: criar o projeto

1. https://supabase.com/dashboard › **New project**.
   - Name: `elaps-prod`.
   - Database password: gere uma forte e guarde (**Database password**).
   - Region: **South America (São Paulo)**.
   - Deixe a Data API ligada (é por ela que o app conversa com o banco).
2. Quando terminar de criar, anote o **Project ref**, a **Project URL** e a **Publishable key**
   (tabela acima). Não copie a secret key para lugar nenhum.

## 2. Supabase: aplicar as migrações

Na raiz do repositório:

```sh
npx supabase login                                   # abre o navegador e guarda um token só nesta máquina
npx supabase link --project-ref <Project ref>        # pede a Database password
npx supabase db push                                 # mostra as migrações pendentes e pede confirmação
npx supabase migration list                          # Local e Remote devem ter as mesmas linhas
```

O `db push` aplica só `supabase/migrations/`. O `seed.sql` (usuário dev e dados de exemplo)
não vai para produção.

## 3. Supabase: autenticação

A configuração de auth vai **pelo painel**. O `npx supabase config push` envia o
`supabase/config.toml` inteiro, que é a configuração do ambiente **local**: `site_url`
`http://localhost:5173`, Google desligado, `skip_nonce_check` ligado e limite de 2 e-mails por
hora. Usá-lo em produção desfaria o que está abaixo. O `npx supabase config diff` só lê e serve
para comparar, mas sempre vai mostrar essas diferenças de propósito.

### 3.1 URLs (Authentication › URL Configuration)

- **Site URL:** `https://elaps.ternal.com.br`
- **Redirect URLs** (Add URL, uma por vez):
  - `https://elaps.ternal.com.br/auth/callback`
  - `https://elaps.ternal.com.br/**` (o app volta com `?next=` na URL; o curinga cobre)

### 3.2 E-mail e cadastro (Authentication › Sign In / Providers › Email)

- **Enable Email provider:** ligado. **Confirm email:** ligado.
- **Allow new users to sign up:** ligado (o primeiro login por link cria a conta).

### 3.3 Modelos de e-mail em pt-BR (Authentication › Emails › Templates)

| Modelo no painel | Assunto (Subject)              | Corpo (Message body): cole o arquivo inteiro |
| ---------------- | ------------------------------ | -------------------------------------------- |
| Magic Link       | `Seu link de acesso ao Elaps`  | `supabase/templates/magic_link.html`         |
| Confirm signup   | `Confirme seu e-mail no Elaps` | `supabase/templates/confirmation.html`       |

Os modelos usam `{{ .ConfirmationURL }}`; não troque essa variável. Sempre que mudar um desses
arquivos no repositório, cole de novo aqui (o painel não lê o repositório).

### 3.4 SMTP próprio (Resend)

O e-mail embutido do Supabase manda pouquíssimos e-mails por hora e só serve para testes.
Configure um SMTP antes de abrir para outras pessoas.

1. **Resend › Domains › Add Domain:** `ternal.com.br`, região padrão.
2. O Resend mostra os registros a criar. São parecidos com estes; use os valores exatos dele,
   na zona do Registro.br (passo 7):
   - `TXT` `resend._domainkey` com a chave DKIM (`p=MIIB…`);
   - `MX` `send` → `feedback-smtp.<região>.amazonses.com` (prioridade 10);
   - `TXT` `send` → `v=spf1 include:amazonses.com ~all`.
3. Espere o Resend mostrar **Verified** (minutos a algumas horas).
4. **Resend › API Keys › Create API Key:** permissão _Sending access_, domínio
   `ternal.com.br` (ou _All domains_). Copie a **Resend API key** (`re_…`); ela só aparece uma
   vez. A chave **não depende da verificação** do domínio: pode criá-la antes do Verified e
   não precisa refazê-la depois. Se _API Keys_ não aparecer no menu do Resend, abra direto
   https://resend.com/api-keys.
5. **Supabase › Authentication › Emails › SMTP Settings:** preencha os campos abaixo, mas
   deixe **Enable custom SMTP DESLIGADO até o Resend mostrar Verified**. Ligado antes, todo
   e-mail de login falha. Enquanto estiver desligado, o e-mail embutido do Supabase só envia
   para os membros do projeto. Quando o Verified aparecer, ligue **Enable custom SMTP** e
   salve.

   | Campo        | Valor                        |
   | ------------ | ---------------------------- |
   | Sender email | `nao-responda@ternal.com.br` |
   | Sender name  | `Elaps`                      |
   | Host         | `smtp.resend.com`            |
   | Port         | `465`                        |
   | Username     | `resend`                     |
   | Password     | a **Resend API key**         |

6. **Authentication › Rate Limits:** com SMTP próprio, suba "emails sent per hour" para algo
   como 30 a 100 (o plano grátis do Resend manda 100 por dia).

**Sobre o DNS de e-mail que já existe em `ternal.com.br`:** a zona hoje diz que o domínio
**não envia nem recebe** e-mail (`TXT v=spf1 -all`, `_dmarc` com `p=reject` e MX nulo). Não
precisa mudar nada disso:

- o SPF do Resend fica no subdomínio `send`, então o `-all` da raiz não atrapalha;
- o DKIM assina como `ternal.com.br`, o que satisfaz o DMARC `p=reject`. Se o DKIM não
  verificar, o DMARC derruba todos os e-mails, então confira o **Verified** antes do teste;
- o MX nulo só significa que ninguém recebe resposta em `ternal.com.br`, o que combina com
  `nao-responda@`.

Opcional: para receber relatórios de entrega, troque o `_dmarc` para
`v=DMARC1; p=reject; rua=mailto:<seu e-mail>`.

### 3.5 Google (login com Google)

1. https://console.cloud.google.com › seletor de projetos › **New project** › `Elaps`.
2. **Google Auth Platform › Branding** (tela de consentimento):
   - App name: `Elaps`.
   - **User support email:** só aceita o e-mail da sua conta Google (ou um Google Group seu).
     **Developer contact:** livre. Não use `@ternal.com.br` em nenhum dos dois: o domínio não
     recebe e-mail (MX nulo).
   - App home page: `https://elaps.ternal.com.br`.
   - **Authorized domains:** `ternal.com.br` e `<Project ref>.supabase.co` (o host da
     _Project URL_, sem `https://`). Não use só `supabase.co`: o Google recusa ("Domínio
     inválido: precisa ser um domínio privado de nível superior") porque `supabase.co` é um
     sufixo público.
3. **Audience:** User type **External**. Depois de testar, **Publish app** (status _In
   production_). Sem isso, só as contas listadas em _Test users_ conseguem entrar. Com os
   escopos padrão (e-mail, perfil, openid) não há revisão do Google.
4. **Clients › Create client › Web application** (nome `Elaps web`):
   - **Authorized JavaScript origins:** `https://elaps.ternal.com.br`
   - **Authorized redirect URIs:** `https://<Project ref>.supabase.co/auth/v1/callback`
     (é o mesmo endereço que o Supabase mostra como _Callback URL_ no provedor Google).
   - Create: copie o **Google Client ID** e o **Google Client secret**.
5. **Supabase › Authentication › Sign In / Providers › Google:** Enable, cole o Client ID em
   _Client IDs_ e o secret em _Client Secret_, Save. O botão "Entrar com Google" do app passa a
   funcionar sozinho (ele consulta se o provedor está ligado).

A tela do Google vai mostrar "prosseguir para `<ref>.supabase.co`". Para mostrar o seu domínio
ali é preciso o _custom domain_ do Supabase, que é pago e opcional.

## 4. Vercel: projeto do app

1. https://vercel.com/new › **Import** do repositório `peRodrigues/elaps`.
2. **Project Name:** `elaps`. **Root Directory:** `apps/app` (Edit › escolha a pasta).
   **Framework Preset:** Vite. Não mexa em Build/Install/Output: o `apps/app/vercel.json`
   define tudo (instala com `npm ci` na raiz do monorepo, builda com
   `npm run build -w apps/app`, publica `dist`, cuida do fallback de SPA e dos cabeçalhos de cache
   e segurança).
3. **Environment Variables** (antes do primeiro deploy; ambiente _Production_):

   | Variável                        | Valor                               |
   | ------------------------------- | ----------------------------------- |
   | `VITE_SUPABASE_URL`             | a **Project URL**                   |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | a **Publishable key**               |
   | `VITE_SHARE_BASE_URL`           | `https://share.elaps.ternal.com.br` |

   As `VITE_*` entram no bundle no build: depois de mudar uma, faça **Redeploy**.

4. **Deploy.** Depois, em **Settings**:
   - **Build and Deployment › Node.js Version:** `24.x`.
   - **Build and Deployment › Root Directory:** deixe ligado "Include files outside the root
     directory in the Build Step" (o app usa `packages/core`).
   - **Git › Production Branch:** `main`.
5. **Settings › Domains › Add:** `elaps.ternal.com.br`. A Vercel mostra o **Destino CNAME**
   (`cname.vercel-dns.com` ou um valor próprio do projeto, como `xxxx.vercel-dns-0xx.com`; use
   o que ela mostrar). Crie o registro no passo 7.

Deploys de _Preview_ (de outras branches) não recebem as variáveis acima, a não ser que você
marque _Preview_ nelas. Se marcar, eles usam o banco de **produção**, e o login neles só
funciona se a URL do preview estiver em Redirect URLs.

## 5. Vercel: projeto do site de compartilhamento

1. https://vercel.com/new › **Import** do mesmo repositório (é um segundo projeto).
2. **Project Name:** `elaps-share`. **Root Directory:** `apps/site`. **Framework Preset:**
   Next.js. Build/Install: o `apps/site/vercel.json` define (`npm ci` na raiz e
   `npm run build -w apps/site`).
3. **Environment Variables** (_Production_):

   | Variável                               | Valor                               |
   | -------------------------------------- | ----------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | a **Project URL**                   |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a **Publishable key**               |
   | `NEXT_PUBLIC_SITE_URL`                 | `https://share.elaps.ternal.com.br` |
   | `NEXT_PUBLIC_APP_URL`                  | `https://elaps.ternal.com.br`       |

   `NEXT_PUBLIC_SITE_URL` é a base da imagem de prévia (`og:image`); errada, o WhatsApp fica
   sem prévia.

4. **Deploy.** Em Settings: Node.js `24.x`, "Include files outside the root directory" ligado
   (o site usa `packages/core`) e Production Branch `main`.
5. **Settings › Domains › Add:** `share.elaps.ternal.com.br`. Anote o **Destino CNAME**.

O site só lê: ele chama a RPC pública `get_share(token)` e não grava nada. Link revogado some
em até 2 minutos (as páginas são regeradas a cada 120 s).

## 6. Conferir as variáveis

Antes de mexer no DNS, abra os endereços `*.vercel.app` de cada projeto (Vercel ›
Deployments) e veja se o app carrega a tela de login e se o site abre a página inicial. O login
ainda não fecha o ciclo: o Site URL aponta para o domínio final.

## 7. DNS de `ternal.com.br`

São dois CNAMEs, com o **Destino CNAME** que cada projeto da Vercel mostrou:

| Tipo  | Nome          | Valor                            |
| ----- | ------------- | -------------------------------- |
| CNAME | `elaps`       | destino do projeto `elaps`       |
| CNAME | `share.elaps` | destino do projeto `elaps-share` |

Mais os registros do Resend (passo 3.4): `TXT resend._domainkey`, `MX send` e `TXT send`.

**Registro.br** (o caso atual): https://registro.br › Painel › `ternal.com.br` › **DNS** ›
**Editar zona** › **Nova entrada**. Em _Nome_, digite só a parte antes do domínio (`elaps`,
`share.elaps`, `resend._domainkey`, `send`). Escolha o _Tipo_, cole o _Valor_ e **Salvar
alterações** no fim; a zona só publica ao salvar. Se o painel pedir o valor terminado em ponto
(`cname.vercel-dns.com.`), acrescente o ponto.

**Se um dia o DNS for para a Cloudflare:** Cloudflare › `ternal.com.br` › **DNS › Records ›
Add record**, mesmos Tipo/Nome/Valor. Nos CNAMEs da Vercel, deixe **Proxy status: DNS only**
(nuvem **cinza**). Com o proxy laranja, a Vercel não consegue emitir o certificado e o domínio
fica "Invalid Configuration". Registros TXT e MX não têm proxy.

Depois de salvar, a Vercel marca o domínio como **Valid Configuration** e emite o HTTPS sozinha
(de minutos a algumas horas). Para conferir: `nslookup elaps.ternal.com.br`.

## 8. Checklist em produção

Faça tudo no celular e no computador, numa janela anônima.

- [ ] https://elaps.ternal.com.br abre com cadeado (HTTPS) e mostra a tela de login.
- [ ] **Link mágico:** peça com um e-mail novo, receba o "Confirme seu e-mail no Elaps", clique
      no mesmo navegador e entre. Saia e peça de novo: chega "Seu link de acesso ao Elaps". O
      remetente é `Elaps <nao-responda@ternal.com.br>`. Se cair no spam ou não chegar, confira
      o Verified do Resend (o DMARC `p=reject` derruba e-mail sem DKIM) e os logs em
      Supabase › Logs › Auth.
- [ ] **Google:** "Entrar com Google" volta logado para o app.
- [ ] **Cronômetro:** crie um grupo e uma área, inicie, pause, retome e pare. A sessão aparece
      em Sessões e no Dashboard. Teste também o modo Pomodoro.
- [ ] **Compartilhar:** em Dashboard › Compartilhar, crie um link público. O link começa com
      `https://share.elaps.ternal.com.br/s/` e abre no celular sem login.
- [ ] **Prévia no WhatsApp:** mande o link para você mesmo; aparece o cartão com a imagem. Para
      depurar, use o https://developers.facebook.com/tools/debug/ (o WhatsApp usa a mesma
      leitura).
- [ ] **Revogar:** revogue o link e, em até 2 minutos, ele mostra "não encontrado".
- [ ] **PWA:** no Android (Chrome), menu › _Instalar app_; no iPhone (Safari), Compartilhar ›
      _Adicionar à Tela de Início_. Abre em janela própria com o ícone do Elaps.
- [ ] Ajustes › Fuso horário está certo para a sua conta.

## 9. A cada nova migração ou deploy

- **Código sem migração:** push na `main` e os dois projetos da Vercel fazem o deploy sozinhos.
  Para voltar atrás: Vercel › Deployments › deploy anterior › **Instant Rollback**.
- **Com migração nova** (arquivo novo em `supabase/migrations/`):
  1. `npx supabase migration list` para ver o que falta.
  2. `npx supabase db push` **antes** do push do código que depende dela. As migrações são
     aditivas; assim o app antigo continua funcionando durante o deploy.
  3. Depois, push do código.
     Migração não desfaz sozinha: para corrigir, crie outra migração.
- **Mudou `supabase/templates/*.html`:** cole de novo no painel (passo 3.3).
- **Mudou alguma `VITE_*` ou `NEXT_PUBLIC_*`:** altere na Vercel e faça **Redeploy** do projeto.
- **Configuração de auth** (URLs, provedores, SMTP, limites): sempre pelo painel, nunca
  `config push` (passo 3).
- **Trocar uma chave vazada:** Supabase › API Keys (gere outra e troque na Vercel), Google ›
  Clients (Reset secret e cole no Supabase), Resend › API Keys (revogue e crie outra).
