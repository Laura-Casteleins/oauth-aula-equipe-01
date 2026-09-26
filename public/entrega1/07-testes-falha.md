# Relatório de Testes de Falha - Projeto OAuth Cloudflare Pages

Este documento registra a execução dos testes de falha obrigatórios para validar o comportamento das rotas de autenticação e os limites de segurança da aplicação.

---

## Caso 1: Retorno sem cookie temporário

* **Preparação:** Início do fluxo de login na janela principal do navegador, pausando a execução na página oficial do provedor (Google/GitHub) antes de conceder a autorização. A URL de retorno com os parâmetros foi copiada para uma janela anônima/privativa onde o cookie temporário `__Host-oauth-tx` não existia.
* **Pedido enviado:** `GET https://oauth-aula-equipe-01.pages.dev/oauth/callback/google?code=[REMOVIDO]&state=[REMOVIDO]` (executado em ambiente sem o cookie temporário).
* **Resultado esperado:** O backend recusar a requisição devido à ausência do cookie temporário de transação e impedir a criação de sessão.
* **Resultado observado:** O servidor bloqueou o callback por falta do cookie de transação, respondeu com erro HTTP 400 e nenhuma sessão local foi registrada no banco D1.

---

## Caso 2: State alterado

* **Preparação:** Início do fluxo de autenticação até o redirecionamento para a página de autorização do provedor. Na barra de endereços, o parâmetro `state` na URL foi manualmente alterado em um caractere antes de enviar.
* **Pedido enviado:** `GET https://oauth-aula-equipe-01.pages.dev/oauth/callback/github?code=[REMOVIDO]&state=[VALOR_ALTERADO]`.
* **Resultado esperado:** Rejeição imediata da solicitação no servidor por divergência entre o `state` recebido e o hash armazenado na transação D1.
* **Resultado observado:** O callback identificou a divergência do parâmetro `state`, interrompeu o fluxo de troca de tokens e retornou mensagem de transação inválida.

---

## Caso 3: Reutilização da transação

* **Preparação:** Conclusão bem-sucedida de um fluxo de login. Cópia da URL completa de retorno (`callback`) a partir do histórico/ferramentas de desenvolvedor.
* **Pedido enviado:** Reenvio manual da requisição `GET https://oauth-aula-equipe-01.pages.dev/oauth/callback/google?code=[REMOVIDO]&state=[REMOVIDO]` diretamente na barra de navegação após o login já ter sido efetuado.
* **Resultado esperado:** O backend negar o processamento, pois a transação de OAuth foi apagada do D1 logo após o primeiro uso.
* **Resultado observado:** A solicitação foi recusada pelo backend por transação inexistente/já consumida.

---

## Caso 4: Sessão expirada

* **Preparação:** Autenticação realizada com sucesso e sessão ativa. Acesso ao console de comandos SQL do banco D1 no painel Cloudflare para forçar a expiração do registro.
* **Pedido enviado:** Execução da instrução SQL `UPDATE sessions SET expires_at = 0;` no console D1, seguida do recarregamento da página que consulta `GET https://oauth-aula-equipe-01.pages.dev/api/me`.
* **Resultado esperado:** A rota `/api/me` identificar a expiração da sessão no banco de dados e responder com status HTTP 401 (Não autorizado).
* **Resultado observado:** A rota `/api/me` respondeu HTTP 401 e a interface atualizou para o estado não autenticado.

---

## Caso 5: Origem inválida na saída

* **Preparação:** Manutenção de uma sessão ativa em `https://oauth-aula-equipe-01.pages.dev`. Abertura de uma nova aba em uma origem externa (`https://example.com`) com o console de desenvolvedor aberto.
* **Pedido enviado:** Execução da requisição de logout a partir do console da origem externa:
  ```javascript
  fetch("[https://oauth-aula-equipe-01.pages.dev/oauth/logout](https://oauth-aula-equipe-01.pages.dev/oauth/logout)", {
    method: "POST",
    credentials: "include"
  });

## Caso 6: Reutilização do cookie revogado
  
* **Preparação:** Cópia manual do valor do cookie __Host-session pelas ferramentas de desenvolvedor durante a sessão ativa. Realização do logout regular pela interface.

* **Pedido enviado:** Re-inserção manual do valor copiado no cookie __Host-session e envio de nova requisição a GET https://oauth-aula-equipe-01.pages.dev/api/me.

* **Resultado esperado:** Retorno de erro HTTP 401 (Não autorizado), visto que os dados da sessão foram permanentemente excluídos do D1 durante o logout.

* **Resultado observado:** A rota /api/me retornou HTTP 401 e impediu o acesso, confirmando a revogação do token no servidor.
