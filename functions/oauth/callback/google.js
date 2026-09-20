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

    // 3. Salvar/Atualizar utilizador na tabela 'users'
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

      // 4. Gerar ID de sessão opaco e seguro
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // 5. Inserir a sessão na tabela 'sessions'
      await env.DB.prepare(
        `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
      ).bind(sessionId, userId, expiresAt).run();

      // 6. Redirecionar para o /dashboard com o cookie seguro
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/dashboard",
          "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`
        }
      });
    }

    return new Response('Base de dados DB não configurada.', { status: 500 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function generateSessionId() {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
}
