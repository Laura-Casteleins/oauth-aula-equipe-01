# Relatório de Testes de Falha - Projeto OAuth Cloudflare Pages

Este documento registra a execução dos testes de falha obrigatórios do laboratório de autenticação OAuth/OIDC em Cloudflare Pages. Os testes foram realizados sem registrar valores sensíveis ou transitórios, como códigos de autorização, cookies, `state`, `nonce`, `code_challenge`, `code_verifier`, tokens ou segredos.

---

## Caso 1 — Retorno sem cookie temporário

**Preparação:**  
O login com Google foi iniciado em uma janela comum e interrompido na página do provedor. A URL de autorização foi copiada e aberta em uma janela privativa, que não possuía o cookie temporário `__Host-oauth-tx`.

**Pedido enviado:**  
O fluxo de autenticação foi concluído na janela privativa, provocando o retorno para `/oauth/callback/google`, sem o cookie temporário de transação.

**Resultado esperado:**  
O callback deveria recusar a resposta pela ausência do cookie `__Host-oauth-tx` e não criar uma sessão local.

**Resultado observado:**  
O callback recusou corretamente a autenticação e apresentou a mensagem `Transação OAuth ausente.`. Nenhuma sessão local foi criada.

---

## Caso 2 — `state` alterado

**Preparação:**  
Foi iniciado um novo login com Google. Na URL original de autorização enviada pela aplicação ao Google, um único caractere do parâmetro `state` foi alterado manualmente antes da conclusão da autenticação.

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
Após forçar a expiração, foi realizada nova consulta à rota `/api/me`.

**Resultado esperado:**  
A sessão deveria ser considerada expirada e `/api/me` deveria recusar a autenticação, retornando HTTP 401.

**Resultado observado:**  
A sessão deixou de ser reconhecida como válida. A rota `/api/me` retornou `{"authenticated":false}`, e a aplicação passou a tratar o usuário como não autenticado.

---

## Caso 5 — Origem inválida no logout

**Preparação:**  
Foi mantida uma sessão válida na aplicação. Em outra aba, foi aberta a origem externa `https://example.com`.

**Pedido enviado:**  
A partir da origem externa, foi enviada uma requisição `POST` para `/oauth/logout` com `credentials: "include"`.

Exemplo utilizado no teste:

```javascript
fetch("https://oauth-aula-equipe-01.pages.dev/oauth/logout", {
  method: "POST",
  credentials: "include"
});
```

**Resultado esperado:**  
A rota deveria rejeitar o logout porque o cabeçalho `Origin` não correspondia a `PUBLIC_BASE_URL`, sem revogar a sessão legítima.

**Resultado observado:**  
A requisição externa foi recusada com HTTP 403 (`Forbidden`). O navegador também impediu a leitura da resposta por CORS, comportamento compatível com uma requisição entre origens distintas.

> **Conferência final recomendada:** após este teste, recarregar a aplicação na aba original e confirmar que a sessão legítima permanece autenticada. Esse ponto deve ser mantido como evidência final do Caso 5.

---

## Caso 6 — Reutilização do cookie revogado

**Preparação:**  
Foi criada uma sessão válida e o valor do cookie `__Host-session` foi copiado temporariamente apenas para execução do teste. Em seguida, foi realizado o logout regular, removendo a sessão do D1 e expirando o cookie no navegador.

**Pedido enviado:**  
O mesmo valor antigo de `__Host-session` foi restaurado manualmente no navegador e a rota `/api/me` foi consultada novamente.

**Resultado esperado:**  
A sessão não deveria ser restaurada, pois o registro correspondente já havia sido removido do D1 durante o logout.

**Resultado observado:**  
A reutilização do cookie antigo não restaurou a sessão. A rota `/api/me` retornou `{"authenticated":false}`, confirmando que o cookie revogado não pode ser reutilizado para autenticação.

---

## Conclusão

Os testes demonstraram que a aplicação rejeita retornos sem a transação temporária, detecta alteração de `state`, impede reutilização de transações OAuth, rejeita sessões expiradas, bloqueia tentativas de logout provenientes de origem inválida e não aceita a reutilização de um cookie de sessão já revogado.

Nenhum valor de cookie, código de autorização, token, `state`, `nonce`, `code_challenge`, `code_verifier` ou segredo deve ser mantido neste arquivo ou nas demais evidências entregues.
