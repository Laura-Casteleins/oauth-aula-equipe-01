export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Erro: Código de autorização não encontrado.', { status: 400 });
  }

  try {
    // 1. Trocar código por token de acesso
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: 'https://oauth-aula-equipe-01.pages.dev/oauth/callback/google'
      })
    });

    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokens.error_description || 'Erro ao obter token');

    // 2. Buscar perfil do utilizador
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const userInfo = await userResponse.json();
    if (!userResponse.ok) throw new Error('Erro ao obter dados do utilizador');

    // 3. Salvar/Atualizar na base de dados D1 (se a binding DB existir)
    if (env.DB) {
      const userId = `google_${userInfo.id}`;
      await env.DB.prepare(`
        INSERT INTO users (id, provider, provider_user_id, name, email, avatar_url)
        VALUES (?, 'google', ?, ?, ?, ?)
        ON CONFLICT(provider, provider_user_id) DO UPDATE SET
          name = excluded.name,
          email = excluded.email,
          avatar_url = excluded.avatar_url
      `).bind(userId, userInfo.id, userInfo.name || '', userInfo.email || '', userInfo.picture || '').run();
    }

    return new Response(JSON.stringify({
      message: 'Autenticação com Google bem-sucedida e guardada no D1!',
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
