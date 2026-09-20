export async function onRequestGet(context) {
  const { request, env } = context;
  const cookieHeader = request.headers.get('Cookie') || '';
  
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      return [name, rest.join('=')];
    })
  );

  const sessionId = cookies['session'];

  if (!sessionId || !env.DB) {
    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const sessionResult = await env.DB.prepare(`
      SELECT s.user_id, u.name, u.email, u.avatar_url, s.expires_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).bind(sessionId).first();

    if (!sessionResult) {
      return new Response(JSON.stringify({ authenticated: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      authenticated: true,
      user: {
        name: sessionResult.name,
        email: sessionResult.email,
        avatar_url: sessionResult.avatar_url
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ authenticated: false, error: err.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
