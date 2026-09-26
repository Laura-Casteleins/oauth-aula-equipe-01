# OAuth/OIDC com Google e GitHub — Cloudflare Pages

Projeto acadêmico de autenticação desenvolvido para Cloudflare Pages, utilizando Cloudflare Functions e banco D1.

URL da aplicação:

[`https://oauth-aula-equipe-01.pages.dev`](https://oauth-aula-equipe-01.pages.dev)

## Objetivo

Implementar autenticação com Google e GitHub usando Authorization Code Flow com PKCE S256, mantendo os segredos apenas no servidor, registrando transações e sessões no D1 e aplicando controles de segurança no início do login, callback, sessão, consulta de usuário e logout.

## Tecnologias utilizadas

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- JavaScript com APIs Web nativas
- Google OpenID Connect
- GitHub OAuth
- PKCE com SHA-256
- Web Crypto API

O projeto foi desenvolvido diretamente no ambiente da Cloudflare, sem uso de Node.js, npm, npx, Wrangler ou pacotes externos para execução da aplicação.

## Estrutura principal

```text
public/
├── index.html
├── app.js
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
│   ├── crypto.js
│   ├── oidc.js
│   ├── providers.js
│   └── session.js
├── api/
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

A pasta `public/entrega1` contém exatamente os 8 arquivos exigidos para a entrega.

## Variáveis e segredos

As seguintes configurações são utilizadas no projeto:

- `PUBLIC_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- binding D1 chamado `DB`

A URL base utilizada é:

`https://oauth-aula-equipe-01.pages.dev`

Os Client Secrets são mantidos como variáveis criptografadas no ambiente Cloudflare e não são expostos no código público, URLs, HTML, armazenamento do navegador ou arquivos de evidência.

## Banco D1

O banco utiliza duas tabelas principais.

### oauth_transactions

Responsável pelas transações temporárias de OAuth.

Campos:

- `id_hash`
- `provider`
- `state_hash`
- `nonce`
- `code_verifier`
- `expires_at`

Também existe o índice:

`oauth_transactions_expiry`

### sessions

Responsável pelas sessões locais autenticadas.

Campos:

- `id_hash`
- `issuer`
- `subject`
- `email`
- `display_name`
- `expires_at`
- `created_at`

Também existe o índice:

`sessions_expiry`

Somente o hash do identificador da sessão é armazenado no D1.

## Geração de valores aleatórios e hashes

Os valores aleatórios são gerados com `crypto.getRandomValues`.

São utilizados 32 bytes aleatórios, codificados em Base64URL sem padding.

O SHA-256 é utilizado para:

- `code_challenge` do PKCE;
- hash do identificador da transação;
- hash do parâmetro `state`;
- hash do identificador da sessão.

## Login com Google

A rota de início é:

`/oauth/login/google`

O fluxo:

1. gera identificador de transação;
2. gera `state`;
3. gera `nonce`;
4. gera `code_verifier`;
5. calcula `code_challenge` com SHA-256;
6. armazena os hashes e dados da transação no D1;
7. cria o cookie temporário `__Host-oauth-tx`;
8. redireciona para o Google.

O pedido ao Google contém:

- `client_id`;
- `redirect_uri`;
- `response_type=code`;
- `scope=openid email profile`;
- `state`;
- `nonce`;
- `code_challenge`;
- `code_challenge_method=S256`.

O Client Secret e o `code_verifier` não são enviados na URL de autorização.

O callback utilizado é:

`/oauth/callback/google`

## Validação Google OIDC

Após o retorno do Google, o código de autorização é trocado no servidor.

O `id_token` recebido é validado antes da criação da sessão local.

A validação inclui:

- estrutura JWT com três partes;
- algoritmo `RS256`;
- obtenção do documento de descoberta OpenID Connect;
- obtenção da chave pública pelo `jwks_uri`;
- seleção da chave pelo `kid`;
- verificação criptográfica da assinatura com Web Crypto;
- validação de `iss`;
- validação de `aud`;
- validação de `exp`;
- validação de `iat`;
- validação de `nonce`;
- validação da existência de `sub`.

A identidade somente é utilizada após a validação criptográfica e semântica do token.

## Login com GitHub

A rota de início é:

`/oauth/login/github`

O fluxo utiliza Authorization Code com PKCE S256.

A URL de autorização inclui:

- `client_id`;
- `redirect_uri`;
- `response_type=code`;
- `state`;
- `code_challenge`;
- `code_challenge_method=S256`.

O início do login GitHub não envia:

- `scope`;
- `nonce`;
- `repo`;
- `user:email`;
- `offline_access`.

O callback utilizado é:

`/oauth/callback/github`

Após a troca do código:

1. é exigido `access_token`;
2. o `token_type` deve ser `Bearer`;
3. é realizada uma requisição para `https://api.github.com/user`;
4. a resposta deve possuir status HTTP 200;
5. o campo `id` deve ser um número inteiro;
6. a identidade local utiliza o ID numérico do GitHub como `subject`;
7. o token GitHub é revogado antes da criação da sessão local;
8. somente após a revogação bem-sucedida é criada a sessão da aplicação.

O e-mail do GitHub pode ser nulo, pois nenhum escopo adicional de e-mail é solicitado.

## Transação OAuth temporária

O cookie temporário utilizado é:

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

A transação é removida antes da conclusão da autenticação para impedir reutilização.

## Sessão local

Após uma autenticação válida, é criado um identificador de sessão opaco e aleatório.

O navegador recebe:

`__Host-session`

Configuração:

```text
Path=/
HttpOnly
Secure
SameSite=Strict
Max-Age=28800
```

A sessão possui duração máxima de 8 horas.

O valor original do identificador da sessão não é armazenado no D1. O banco mantém apenas seu hash SHA-256.

## Endpoint /api/me

A rota:

`/api/me`

consulta o cookie `__Host-session`, calcula seu hash e verifica a sessão correspondente no D1.

Para sessão válida, retorna os dados mínimos do usuário autenticado.

Para sessão ausente, inválida ou expirada, retorna HTTP 401 com:

```json
{"authenticated":false}
```

As respostas utilizam:

`Cache-Control: no-store`

## Logout

O logout é realizado exclusivamente por:

`POST /oauth/logout`

A rota verifica se o cabeçalho `Origin` corresponde exatamente a `PUBLIC_BASE_URL`.

Quando o logout é válido:

1. identifica a sessão pelo cookie;
2. calcula o hash do identificador;
3. remove a sessão correspondente do D1;
4. expira o cookie `__Host-session`;
5. retorna para a aplicação.

Tentativas de logout originadas de outro domínio são recusadas.

## Aplicação estática

A interface pública utiliza arquivos estáticos em `public`.

O JavaScript da aplicação consulta `/api/me` com credenciais de mesma origem para verificar o estado de autenticação.

O logout é enviado por formulário HTTP `POST`.

Nenhum token OAuth é armazenado em `localStorage` ou `sessionStorage`.

## Testes de falha

O arquivo:

`public/entrega1/07-testes-falha.md`

documenta 6 testes obrigatórios e 1 teste complementar.

Foram verificados:

1. retorno sem cookie temporário;
2. alteração do parâmetro `state`;
3. reutilização de callback/transação;
4. sessão expirada;
5. tentativa de logout a partir de origem inválida;
6. reutilização de cookie de sessão após logout;
7. transação OAuth expirada, como teste complementar.

Os resultados confirmaram a rejeição das condições inválidas testadas.

## Evidências da entrega

A pasta `public/entrega1` contém:

### 01-pages-configuracao.pdf

Evidência da configuração do projeto Cloudflare Pages.

### 02-google-retorno.txt

Registro relacionado ao retorno do fluxo Google.

### 03-github-retorno.txt

Registro relacionado ao retorno do fluxo GitHub.

### 04-d1-esquema.txt

Registro dos objetos relevantes existentes no `sqlite_schema` do banco D1.

### 05-inicio-login-google.pdf

Evidência do início do login Google, incluindo resposta HTTP 302, PKCE S256 e cookie temporário seguro.

Os valores transitórios como `state`, `nonce`, `code_challenge` e cookie de transação foram removidos das evidências.

### 06-inicio-login-github.pdf

Evidência do início do login GitHub, incluindo resposta HTTP 302, PKCE S256 e cookie temporário seguro.

Os valores de `state`, `code_challenge` e cookie de transação foram removidos das evidências.

### 07-testes-falha.md

Descrição dos testes negativos e resultados observados.

### 08-aceitacao.md

Checklist final de aceitação do projeto.

## Segurança das evidências

Antes da entrega, foram removidos ou ocultados das capturas e documentos valores como:

- cookies;
- códigos de autorização;
- access tokens;
- Client Secrets;
- `state`;
- `nonce`;
- `code_challenge`;
- `code_verifier`.

Não devem ser incluídos segredos ou valores reutilizáveis no repositório ou nos arquivos de entrega.

## Critérios atendidos

A solução implementa:

- Google e GitHub na mesma origem;
- Authorization Code com PKCE S256;
- transações temporárias armazenadas no D1;
- validação de `state`;
- `nonce` no Google OIDC;
- validação criptográfica do Google `id_token`;
- identificação do usuário GitHub por `/user`;
- revogação do token GitHub antes da sessão local;
- sessão opaca;
- armazenamento somente do hash da sessão;
- cookie seguro, HttpOnly e com prefixo `__Host-`;
- `/api/me`;
- logout somente por POST;
- validação exata do `Origin`;
- revogação da sessão no D1;
- proteção contra reutilização da sessão após logout;
- respostas de autenticação sem cache.

## Observação final

Após a conclusão dos testes e da entrega, sessões administrativas utilizadas em computadores compartilhados devem ser encerradas, e qualquer valor temporário copiado durante os testes deve ser descartado.
