export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 1. O código de autorização enviado pela Google na query string
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Erro: Código de autorização não encontrado.', { status: 400 });
  }

  try {
    // 2. Trocar o código de autorização por um Token de Acesso (Access Token)
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://oauth-aula-equipe-01.pages.dev/oauth/callback/google',
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || 'Falha ao obter tokens da Google');
    }

    // 3. Obter as informações do perfil do utilizador usando o Access Token
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const userInfo = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error('Falha ao obter dados do utilizador da Google');
    }

    // Por enquanto, vamos retornar os dados do utilizador em formato JSON para testar se funcionou!
    return new Response(JSON.stringify({
      message: 'Autenticação com Google bem-sucedida!',
      user: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
