export async function onRequestGet(context) {
  // O 'env' permite-nos aceder àquelas variáveis secretas que guardámos na Cloudflare
  const { env, request } = context;

  // 1. O endereço oficial da Google para iniciar o OAuth
  const googleLoginUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  // 2. Preencher os parâmetros que a Google exige
  googleLoginUrl.searchParams.append('client_id', env.GOOGLE_CLIENT_ID);
  
  // O endereço exato de callback que configurámos no painel da Google
  googleLoginUrl.searchParams.append('redirect_uri', 'https://oauth-aula-equipe-01.pages.dev/oauth/callback/google');
  
  // O tipo de resposta (queremos um código de autorização)
  googleLoginUrl.searchParams.append('response_type', 'code');
  
  // O que queremos saber do utilizador (o email e o perfil básico)
  googleLoginUrl.searchParams.append('scope', 'openid email profile');
  
  // Opcional: força a Google a perguntar qual conta escolher (útil para testes)
  googleLoginUrl.searchParams.append('prompt', 'select_account');

  // 3. Redirecionar o navegador do utilizador para esse link da Google
  return Response.redirect(googleLoginUrl.toString(), 302);
}
