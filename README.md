# OAuth/OIDC com Google e GitHub — Cloudflare Pages

Projeto acadêmico de autenticação desenvolvido em Cloudflare Pages, utilizando Pages Functions, banco D1, Google OpenID Connect e GitHub OAuth.

URL de produção:

[`https://oauth-aula-equipe-01.pages.dev`](https://oauth-aula-equipe-01.pages.dev)

## Objetivo

Implementar autenticação com Google e GitHub por Authorization Code Flow com PKCE S256, mantendo segredos apenas no ambiente servidor, registrando transações e sessões no D1 e aplicando controles de segurança no início do login, callback, sessão, consulta de usuário e logout.

## Tecnologias utilizadas

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- JavaScript com APIs Web nativas
- Google OpenID Connect
- GitHub OAuth
- PKCE com SHA-256
- Web Crypto API

O projeto não utiliza Node.js, npm, npx, Wrangler, `package.json`, `package-lock.json`, `node_modules` ou bibliotecas externas para executar a autenticação.

## Estrutura principal do projeto

```text
public/
├── index.html
├── app.js
├── styles.css
└── entrega1/
    ├── 01-pages-configuracao.pdf
    ├── 02-google-retorno.txt
    ├── 03-github-retorno.txt
    ├── 04-d1-esquema.txt
    ├── 05-inicio-login-google.pdf
    ├── 06-inicio-login-github.pdf
    ├── 07-testes-falha.md
    └── 08-aceitacao.md

functions/
├── _shared/
│   ├── cookies.js
│   ├── crypto.js
│   ├── oidc.js
│   ├── providers.js
│   └── session.js
├── api/
│   ├── health.js
│   └── me.js
└── oauth/
    ├── login/
    │   ├── google.js
    │   └── github.js
    ├── callback/
    │   ├── google.js
    │   └── github.js
    └── logout.js
```

A pasta `public/entrega1` contém exatamente os oito arquivos exigidos para a entrega.

## Configuração do Cloudflare Pages

O projeto utiliza:

- `PUBLIC_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GITHUB_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_SECRET`
- binding D1 chamado `DB`

A URL base de produção é:

`https://oauth-aula-equipe-01.pages.dev`

`PUBLIC_BASE_URL` não possui barra final.

Os Client IDs são configurados como variáveis de texto. Os Client Secrets são configurados como segredos criptografados no Cloudflare Pages e não são armazenados no repositório.

## Banco D1

O D1 utiliza duas tabelas principais.

### `oauth_transactions`

Armazena as transações temporárias do fluxo OAuth.

Campos:

- `id_hash`
- `provider`
- `state_hash`
- `nonce`
- `code_verifier`
- `expires_at`

Índice:

`oauth_transactions_expiry`

### `sessions`

Armazena as sessões locais autenticadas.

Campos:

- `id_hash`
- `issuer`
- `subject`
- `email`
- `display_name`
- `expires_at`
- `created_at`

Índice:

`sessions_expiry`

O D1 armazena somente o hash do identificador da sessão, e não o valor bruto do cookie.

## Geração de valores aleatórios e hashes

Os valores aleatórios são gerados com:

`crypto.getRandomValues()`

São utilizados 32 bytes aleatórios, codificados em Base64URL sem padding.

SHA-256 é utilizado para calcular:

- `code_challenge` a partir do `code_verifier`;
- hash do identificador da transação;
- hash de `state`;
- hash do identificador da sessão.

## Login com Google

Rota:

`GET /oauth/login/google`

O início do fluxo:

1. gera o identificador da transação;
2. gera `state`;
3. gera `nonce`;
4. gera `code_verifier`;
5. calcula `code_challenge` com SHA-256;
6. grava a transação no D1;
7. cria o cookie temporário `__Host-oauth-tx`;
8. responde com redirecionamento HTTP 302 para o Google.

O pedido de autorização contém:

- `client_id`;
- `redirect_uri`;
- `response_type=code`;
- `scope=openid email profile`;
- `state`;
- `nonce`;
- `code_challenge`;
- `code_challenge_method=S256`.

O Client Secret e o `code_verifier` não aparecem na URL de autorização.

Callback:

`https://oauth-aula-equipe-01.pages.dev/oauth/callback/google`

## Validação do Google OIDC

No callback do Google, a aplicação:

1. exige `code` e `state`;
2. exige o cookie temporário;
3. localiza uma transação válida e não expirada;
4. compara o hash de `state`;
5. remove a transação antes de concluir o fluxo;
6. troca o código usando o `code_verifier` e o Client Secret;
7. valida o `id_token`;
8. cria a sessão local somente após a validação completa.

A validação do `id_token` inclui:

- JWT com três partes;
- `alg=RS256`;
- descoberta OIDC;
- obtenção do `jwks_uri`;
- seleção da chave por `kid`;
- importação da JWK;
- verificação da assinatura com Web Crypto;
- validação de `iss`;
- validação de `aud`;
- validação de `exp`;
- validação de `iat`;
- validação de `nonce`;
- validação de `sub`.

## Login com GitHub

Rota:

`GET /oauth/login/github`

O pedido de autorização contém:

- `client_id`;
- `redirect_uri`;
- `response_type=code`;
- `state`;
- `code_challenge`;
- `code_challenge_method=S256`.

O pedido ao GitHub omite:

- `scope`;
- `nonce`;
- `repo`;
- `user:email`;
- `offline_access`.

Callback:

`https://oauth-aula-equipe-01.pages.dev/oauth/callback/github`

Após a troca do código, a aplicação:

1. exige `access_token`;
2. exige `token_type` compatível com `Bearer`;
3. consulta `GET https://api.github.com/user`;
4. envia `Authorization: Bearer`;
5. envia `Accept: application/vnd.github+json`;
6. envia `X-GitHub-Api-Version: 2026-03-10`;
7. exige resposta HTTP 200;
8. exige um `id` inteiro;
9. usa `https://github.com` como `issuer`;
10. converte o `id` numérico para texto e o utiliza como `subject`;
11. usa `name` ou `login` apenas para apresentação;
12. aceita e-mail nulo;
13. revoga a autorização no GitHub antes de criar a sessão local.

A revogação é feita por:

`DELETE https://api.github.com/applications/{client_id}/grant`

A aplicação exige HTTP 204 antes de criar a sessão local.

## Cookie temporário da transação

Cookie:

`__Host-oauth-tx`

Configuração:

```text
Path=/
HttpOnly
Secure
SameSite=Lax
Max-Age=600
```

A aplicação rejeita transações:

- ausentes;
- expiradas;
- com `state` alterado;
- já utilizadas.

## Sessão local

Após a confirmação da identidade, é criado um identificador de sessão aleatório e opaco.

Cookie:

`__Host-session`

Configuração:

```text
Path=/
HttpOnly
Secure
SameSite=Strict
Max-Age=28800
```

A sessão possui duração de 8 horas.

O navegador recebe o identificador bruto da sessão, enquanto o D1 armazena apenas o hash SHA-256 correspondente.

## `/api/me`

Rota:

`GET /api/me`

A rota:

1. lê o cookie `__Host-session`;
2. calcula seu hash;
3. procura uma sessão válida e não expirada no D1;
4. devolve somente o perfil mínimo necessário.

Para uma sessão ausente, inválida ou expirada, responde com HTTP 401.

As respostas utilizam:

`Cache-Control: no-store`

## `/api/health`

A rota de saúde é utilizada para verificar se as Pages Functions estão reconhecidas e respondendo corretamente na implantação.

## Logout

Rota:

`POST /oauth/logout`

O logout:

1. aceita somente POST;
2. exige que o cabeçalho `Origin` seja exatamente igual a `PUBLIC_BASE_URL`;
3. identifica a sessão pelo cookie;
4. calcula o hash da sessão;
5. remove a sessão correspondente do D1;
6. expira o cookie `__Host-session`;
7. responde com `Cache-Control: no-store`.

Uma requisição de logout originada de outro domínio é recusada e não deve invalidar a sessão legítima.

## Aplicação estática

Os arquivos em `public` permanecem públicos e podem ser acessados diretamente por URL.

A página consulta:

`/api/me`

com credenciais de mesma origem.

O logout é realizado por formulário HTTP POST.

Nenhum `access_token`, `refresh_token` ou Client Secret é enviado ao navegador para armazenamento.

## Testes de falha

O arquivo:

`public/entrega1/07-testes-falha.md`

registra os seis testes obrigatórios e um teste complementar.

Testes registrados:

1. retorno sem cookie temporário;
2. `state` alterado;
3. reutilização da transação;
4. sessão expirada;
5. origem inválida no logout;
6. reutilização do cookie revogado;
7. transação OAuth expirada, como teste complementar.

No teste de origem inválida, a tentativa externa é recusada e a sessão original permanece válida.

## Evidências da entrega

A pasta `public/entrega1` contém exatamente:

### `01-pages-configuracao.pdf`

Evidência da configuração do Cloudflare Pages, incluindo projeto, ramificação de produção e opções de construção.

### `02-google-retorno.txt`

URL de retorno cadastrada no Google.

### `03-github-retorno.txt`

Homepage URL e Authorization callback URL cadastradas no GitHub.

### `04-d1-esquema.txt`

Nomes e tipos retornados pelo `sqlite_schema` do D1.

### `05-inicio-login-google.pdf`

Cabeçalhos saneados do início do login Google.

A evidência mostra:

- HTTP 302;
- `__Host-oauth-tx`;
- `Location` para o Google;
- `response_type=code`;
- `code_challenge_method=S256`;
- URL de retorno correta;
- ausência de Client Secret e `code_verifier`.

Valores transitórios como cookie, `state`, `nonce` e `code_challenge` foram ocultados.

### `06-inicio-login-github.pdf`

Cabeçalhos saneados do início do login GitHub.

A evidência mostra:

- HTTP 302;
- `__Host-oauth-tx`;
- `Location` para o GitHub;
- `response_type=code`;
- `code_challenge_method=S256`;
- ausência de `nonce`;
- ausência de `scope`, `repo`, `user:email` e `offline_access`.

Valores transitórios como cookie, `state` e `code_challenge` foram ocultados.

### `07-testes-falha.md`

Registro dos testes obrigatórios e seus resultados observados.

### `08-aceitacao.md`

Lista final dos critérios de aceitação da atividade.

## Segurança das evidências

Não devem aparecer nas evidências:

- valores de cookies;
- códigos de autorização;
- access tokens;
- refresh tokens;
- Client Secrets;
- `state`;
- `nonce`;
- `code_challenge`;
- `code_verifier`;
- corpos completos de troca de tokens.

Quando necessário, valores sensíveis ou transitórios devem ser substituídos por:

`[REMOVIDO]`

## Critérios implementados

A solução implementa:

- publicação em endereço `pages.dev`;
- arquivos estáticos e Functions na mesma origem;
- integração do projeto com GitHub;
- Authorization Code com PKCE S256;
- URLs de retorno específicas para Google e GitHub;
- Client Secret somente no servidor;
- transações temporárias no D1;
- proteção por `state`;
- `nonce` no Google;
- validação criptográfica e semântica do Google `id_token`;
- confirmação da identidade GitHub pela API `/user`;
- revogação da autorização GitHub antes da criação da sessão;
- sessão local opaca;
- hash da sessão armazenado no D1;
- cookie de sessão `Secure`, `HttpOnly` e `SameSite=Strict`;
- `/api/me`;
- logout somente por POST;
- validação exata do `Origin`;
- remoção da sessão do D1 no logout;
- proteção contra reutilização de cookie revogado;
- `Cache-Control: no-store` nas respostas relacionadas à autenticação e sessão.
