# Laboratório OAuth — Cloudflare Pages

Projeto desenvolvido para o laboratório de autenticação em um site estático publicado no Cloudflare Pages, utilizando Google e GitHub como provedores de identidade e Cloudflare D1 para armazenamento de transações OAuth e sessões locais.

## Acesso ao projeto

Aplicação em produção:

https://oauth-aula-equipe-01.pages.dev

## Objetivo

A aplicação demonstra um fluxo de autenticação seguro em uma única origem, mantendo os arquivos estáticos em `public/` e as rotas dinâmicas em `functions/`.

O navegador não recebe `Client Secret`, `access_token` ou `refresh_token`. Após a confirmação da identidade, a aplicação cria uma sessão local opaca armazenada de forma revogável no D1.

## Estrutura

```text
oauth-aula-equipe-01/
├── public/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── entrega1/
│       ├── 01-pages-configuracao.pdf
│       ├── 02-google-retorno.txt
│       ├── 03-github-retorno.txt
│       ├── 04-d1-esquema.txt
│       ├── 05-inicio-login-google.pdf
│       ├── 06-inicio-login-github.pdf
│       ├── 07-testes-falha.md
│       └── 08-aceitacao.md
└── functions/
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

## Rotas

| Método | Rota | Função |
|---|---|---|
| GET | `/oauth/login/google` | Inicia autenticação Google com `state`, `nonce` e PKCE S256 |
| GET | `/oauth/login/github` | Inicia autenticação GitHub com `state` e PKCE S256 |
| GET | `/oauth/callback/google` | Valida transação e `id_token` OIDC do Google |
| GET | `/oauth/callback/github` | Confirma identidade pelo GitHub, revoga a autorização e cria a sessão local |
| GET | `/api/me` | Consulta a sessão local e devolve o perfil mínimo |
| POST | `/oauth/logout` | Valida `Origin`, remove a sessão do D1 e expira o cookie |
| GET | `/api/health` | Verificação simples de funcionamento das Pages Functions |

## Segurança implementada

- `state` para proteção da transação OAuth;
- PKCE S256 com `code_verifier` e `code_challenge`;
- `nonce` no fluxo OIDC do Google;
- transações temporárias armazenadas no D1;
- cookies temporários `__Host-oauth-tx` com `HttpOnly`, `Secure`, `SameSite=Lax` e validade de 10 minutos;
- validação criptográfica do `id_token` do Google com RS256 e JWKS;
- validação de `iss`, `aud`, `exp`, `iat` e `nonce`;
- consulta autenticada a `GET /user` no GitHub;
- revogação da autorização GitHub antes da criação da sessão local;
- sessões opacas de 8 horas;
- cookie final `__Host-session` com `HttpOnly`, `Secure`, `SameSite=Strict` e sem `Domain`;
- D1 armazena apenas o resumo SHA-256 do identificador de sessão;
- `/api/me` usa `Cache-Control: no-store`;
- logout somente por POST e com validação de `Origin`.

## Variáveis e segredos no Cloudflare Pages

Variáveis de texto:

```text
PUBLIC_BASE_URL
GOOGLE_CLIENT_ID
GITHUB_CLIENT_ID
```

Segredos criptografados:

```text
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_SECRET
```

Os valores dos segredos não devem ser adicionados ao repositório.

## Banco D1

Binding utilizado pela aplicação:

```text
DB
```

Estruturas principais:

```text
oauth_transactions
oauth_transactions_expiry
sessions
sessions_expiry
```

A tabela `oauth_transactions` mantém apenas os dados necessários à transação temporária. A tabela `sessions` mantém a identidade mínima e o hash do cookie da sessão.

## Testes executados

Foram executados os seguintes testes de falha:

1. retorno sem cookie temporário;
2. alteração do parâmetro `state`;
3. reutilização de uma transação já consumida;
4. sessão expirada;
5. tentativa de logout a partir de origem inválida;
6. reutilização de cookie de sessão revogado;
7. transação OAuth forçada a expirar no D1.

Os resultados detalhados estão em `public/entrega1/07-testes-falha.md`.

## Observação sobre arquivos estáticos

O login não torna privados os arquivos da pasta `public/`. Todo arquivo publicado nessa pasta permanece acessível diretamente por sua URL. A autenticação protege apenas as rotas dinâmicas que consultam e validam a sessão local.

## Equipe

- Laura Casteleins
- Gabriel Mendes

## Entrega

As evidências exigidas para avaliação estão em:

```text
public/entrega1/
```

Antes da entrega final, deve ser feita uma última conferência para garantir que nenhum cookie, código de autorização, token, `state`, `nonce`, `code_challenge`, `code_verifier` ou segredo esteja presente nos arquivos de evidência.
