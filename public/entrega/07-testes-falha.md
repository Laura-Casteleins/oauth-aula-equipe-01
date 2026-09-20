# Relatório de Testes de Falha - Projeto OAuth Cloudflare Pages

Este documento regista os cenários de teste de falha executados para validar o comportamento do sistema de autenticação e segurança da aplicação.

## Cenário 1: Acesso direto à rota de Callback sem o código de autorização
* **Objetivo:** Verificar se a aplicação bloqueia acessos diretos ou manuais às rotas de retorno sem a autenticação prévia dos fornecedores.
* **Ação:** Aceder diretamente via navegador a `https://oauth-aula-equipe-01.pages.dev/oauth/callback/google` (ou `/github`) sem passar pelo fluxo de login.
* **Resultado Esperado:** Retornar um erro HTTP 400 com a mensagem *"Erro: Código de autorização não encontrado"*.
* **Status:** ✅ Aprovado (O sistema bloqueou corretamente).

## Cenário 2: Utilização de Credenciais/Parâmetros inválidos
* **Objetivo:** Garantir que o backend rejeita tokens ou códigos de autorização corrompidos ou adulterados.
* **Ação:** Iniciar o login e simular a alteração do parâmetro `code` na URL de retorno para um valor inválido (`?code=token_falso_123`).
* **Resultado Esperado:** O servidor falhar ao trocar o código com a API do Google/GitHub, retornando erro HTTP 500 com mensagem descritiva de falha.
* **Status:** ✅ Aprovado (Exceção capturada e tratada com segurança).

## Cenário 3: Tentativa de Acesso com Sessão Inválida ou Expirada
* **Objetivo:** Validar o isolamento e proteção das rotas autenticadas.
* **Ação:** Tentar consultar o painel ou rotas protegidas após efetuar o encerramento de sessão (Logout) ou com um cookie de sessão inexistente.
* **Resultado Esperado:** O utilizador é mantido no estado "Não autenticado" e impedido de visualizar dados protegidos.
* **Status:** ✅ Aprovado.
