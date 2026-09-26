# 07 — Testes de Falha

Este documento registra os testes de falha executados no laboratório de autenticação OAuth/OIDC com Google e GitHub em Cloudflare Pages.

Os testes foram realizados sem registrar nas evidências valores sensíveis ou transitórios, como cookies, códigos de autorização, tokens, `state`, `nonce`, `code_challenge`, `code_verifier` ou Client Secrets.

---

## Caso 1 — Retorno sem cookie temporário

**Preparação:**  
O login com Google foi iniciado em uma janela comum e interrompido na página do provedor. A URL de autorização foi copiada e aberta em uma janela privativa, que não possuía o cookie temporário `__Host-oauth-tx`.

**Pedido enviado:**  
O fluxo de autenticação foi concluído na janela privativa, provocando o retorno para `/oauth/callback/google` sem o cookie temporário de transação.

**Resultado esperado:**  
O callback deveria recusar a resposta pela ausência do cookie `__Host-oauth-tx` e não criar uma sessão local.

**Resultado observado:**  
O callback recusou corretamente a autenticação e apresentou a mensagem `Transação OAuth ausente.`. Nenhuma sessão local foi criada.

---

## Caso 2 — `state` alterado

**Preparação:**  
Foi iniciado um novo login com Google. Antes da conclusão da autenticação, um único caractere do parâmetro `state` da URL original de autorização foi alterado manualmente.

**Pedido enviado:**  
O fluxo OAuth foi concluído com o valor de `state` modificado e retornou para `/oauth/callback/google`.

**Resultado esperado:**  
O callback deveria rejeitar a resposta antes da troca do código, pois o hash do `state` recebido não corresponderia ao `state_hash` armazenado no D1.

**Resultado observado:**  
O callback recusou corretamente a autenticação e apresentou a mensagem `State inválido.`. A autenticação não foi concluída e nenhuma nova sessão foi criada.

---

## Caso 3 — Reutilização da transação

**Preparação:**  
Foi realizado um login completo e bem-sucedido com Google. Após a conclusão do fluxo, a URL de retorno utilizada no callback foi localizada nas ferramentas de desenvolvimento e copiada temporariamente.

**Pedido enviado:**  
A mesma URL de callback utilizada no login anterior foi acessada novamente no navegador.

**Resultado esperado:**  
A reutilização deveria ser recusada, pois a transação OAuth já havia sido consumida e removida do D1 após o primeiro uso.

**Resultado observado:**  
O callback recusou a reutilização e apresentou a mensagem `Transação OAuth ausente.`. A tentativa não criou uma nova sessão de autenticação.

---

## Caso 4 — Sessão expirada

**Preparação:**  
Foi criada uma sessão válida por meio de login bem-sucedido. Em seguida, no console do banco D1, foi executado:

```sql
UPDATE sessions
SET expires_at = 0;
```

**Pedido enviado:**  
Após forçar a expiração da sessão, foi realizada uma nova consulta à rota `/api/me`.

**Resultado esperado:**  
A sessão deveria ser considerada expirada e a rota `/api/me` deveria recusar a autenticação, retornando HTTP 401.

**Resultado observado:**  
A sessão deixou de ser reconhecida como válida. A rota `/api/me` retornou:

```json
{"authenticated":false}
```

confirmando que o usuário não permaneceu autenticado.

---

## Caso 5 — Origem inválida no logout

**Preparação:**  
Foi criada uma sessão válida na aplicação. Em seguida, foi aberta uma página pertencente a outra origem, `https://example.com`.

**Pedido enviado:**  
A partir da origem externa, foi enviada uma requisição `POST` para `/oauth/logout`, utilizando `credentials: "include"`.

Exemplo utilizado durante o teste:

```javascript
fetch("https://oauth-aula-equipe-01.pages.dev/oauth/logout", {
  method: "POST",
  credentials: "include"
});
```

**Resultado esperado:**  
A rota deveria recusar a operação porque o cabeçalho `Origin` não correspondia a `PUBLIC_BASE_URL`, sem revogar a sessão legítima.

**Resultado observado:**  
A requisição externa foi recusada com HTTP `403 (Forbidden)`. O navegador também bloqueou a leitura da resposta devido à política de CORS. Após retornar à aplicação, a tentativa externa não foi aceita como logout legítimo.

---

## Caso 6 — Reutilização do cookie revogado

**Preparação:**  
Foi criada uma sessão válida e o valor do cookie `__Host-session` foi copiado temporariamente apenas para a execução do teste. Em seguida, foi realizado o logout regular, removendo a sessão correspondente do D1 e expirando o cookie no navegador.

**Pedido enviado:**  
O mesmo valor antigo do cookie `__Host-session` foi restaurado manualmente no navegador e a rota `/api/me` foi consultada novamente.

**Resultado esperado:**  
A sessão não deveria ser restaurada, pois o registro correspondente já havia sido removido do D1 durante o logout.

**Resultado observado:**  
A reutilização do cookie antigo não restaurou a sessão. A rota `/api/me` retornou:

```json
{"authenticated":false}
```

confirmando que um cookie revogado não pode ser reutilizado para autenticação.

---

## Teste complementar — Transação OAuth expirada

**Preparação:**  
Foi iniciado um novo login com Google e a transação correspondente foi localizada no banco D1. Antes da conclusão da autenticação, o campo `expires_at` dessa transação foi alterado para `0`.

**Pedido enviado:**  
O fluxo de autenticação foi concluído utilizando a mesma transação após a alteração de sua expiração.

**Resultado esperado:**  
A rota de callback deveria rejeitar a transação por estar expirada e não criar uma nova sessão local.

**Resultado observado:**  
O callback recusou corretamente a autenticação e apresentou a mensagem `Transação OAuth inválida ou expirada.`. Nenhuma nova sessão foi criada.

---

## Conclusão

Os testes demonstraram que a aplicação:

- rejeita retornos sem o cookie temporário de transação;
- detecta alteração do parâmetro `state`;
- impede a reutilização de uma transação OAuth já consumida;
- rejeita sessões expiradas;
- bloqueia tentativas de logout provenientes de origem inválida;
- impede a reutilização de cookies de sessão revogados;
- rejeita transações OAuth expiradas.

Nenhum valor de cookie, código de autorização, token, Client Secret, `state`, `nonce`, `code_challenge` ou `code_verifier` deve ser incluído nas evidências entregues.
