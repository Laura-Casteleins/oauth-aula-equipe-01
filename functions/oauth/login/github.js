export async function onRequestGet(context) {
  const { env } = context;

  // 1. O endereço oficial do GitHub para iniciar o OAuth
  const githubLoginUrl = new URL('https://github.com/login/oauth/authorize');
  
  // 2. Preencher os parâmetros exigidos pelo GitHub
  githubLoginUrl.searchParams.append('client_id', env.GITHUB_CLIENT_ID);
  
  // O endereço exato de callback configurado no GitHub
  githubLoginUrl.searchParams.append('redirect_uri', 'https://oauth-aula-equipe-01.pages.dev/oauth/callback/github');
  
  // O que queremos saber do utilizador (leitura do perfil e do email)
  githubLoginUrl.searchParams.append('scope', 'read:user user:email');

  // 3. Redirecionar o navegador do utilizador para o GitHub
  return Response.redirect(githubLoginUrl.toString(), 302);
}
