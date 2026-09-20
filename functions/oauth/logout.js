export async function onRequestGet(context) {
  const { request, env } = context;
  const cookieHeader = request.headers.get('Cookie') || '';
  
  // Ler os cookies enviados pelo navegador
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      return [name, rest.join('=')];
    })
  );

  const sessionId = cookies['session'];

  try {
    // Se existir uma sessão ativa e a base de dados estiver configurada, removemos do D1
    if (sessionId && env.DB) {
      await env.DB.prepare(
        `DELETE FROM sessions WHERE id = ?`
      ).bind(sessionId).run();
    }
  } catch (err) {
    console.error('Erro ao remover sessão da base de dados:', err);
  }

  // Redirecionar para a página inicial (/) e limpar o cookie definindo Max-Age=0
  return new Response(null, {
    status: 302,
    headers: {
      "Location": "/",
      "Set-Cookie": `session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    }
  });
}
