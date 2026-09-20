export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 1. Obter o código enviado pelo GitHub
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Erro: Código de autorização não encontrado.', { status: 400 });
  }

  try {
    // 2. Trocar o código por um Access Token do GitHub
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json' // Essencial para o GitHub devolver a resposta em JSON
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      throw new Error(tokens.error_description || 'Falha ao obter tokens do GitHub');
    }

    // 3. Obter os dados do utilizador com o Access Token
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'User-Agent': 'Cloudflare-Pages-OAuth-App' // O GitHub exige um User-Agent na requisição
      }
    });

    const userInfo = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error('Falha ao obter dados do utilizador do GitHub');
    }

    // Retornar os dados no ecrã para confirmar que funcionou!
    return new Response(JSON.stringify({
      message: 'Autenticação com GitHub bem-sucedida!',
      user: {
        username: userInfo.login,
        name: userInfo.name,
        avatar: userInfo.avatar_url,
        profile_url: userInfo.html_url
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
