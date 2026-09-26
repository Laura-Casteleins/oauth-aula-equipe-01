import {
  sha256Base64Url
} from "../_shared/crypto.js";


function getCookie(request, name) {
  const cookieHeader =
    request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader.split(";");

  for (const cookie of cookies) {

    const [key, ...valueParts] =
      cookie.trim().split("=");

    if (key === name) {
      return valueParts.join("=");
    }
  }

  return null;
}


export async function onRequestGet(context) {

  const { request, env } = context;

  try {

    // --------------------------------------------------
    // 1. Ler cookie da sessão
    // --------------------------------------------------

    const sessionId =
      getCookie(
        request,
        "__Host-session"
      );


    if (!sessionId) {
      return new Response(
        JSON.stringify({
          authenticated: false
        }),
        {
          status: 401,

          headers: {
            "Content-Type":
              "application/json",

            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 2. Calcular hash do cookie
    // --------------------------------------------------

    const sessionIdHash =
      await sha256Base64Url(
        sessionId
      );


    // --------------------------------------------------
    // 3. Buscar sessão válida no D1
    // --------------------------------------------------

    const now =
      Math.floor(Date.now() / 1000);


    const session =
      await env.DB
        .prepare(`
          SELECT
            issuer,
            subject,
            email,
            display_name,
            expires_at

          FROM sessions

          WHERE id_hash = ?
            AND expires_at > ?
        `)
        .bind(
          sessionIdHash,
          now
        )
        .first();


    // --------------------------------------------------
    // 4. Sessão inexistente ou expirada
    // --------------------------------------------------

    if (!session) {

      return new Response(
        JSON.stringify({
          authenticated: false
        }),
        {
          status: 401,

          headers: {
            "Content-Type":
              "application/json",

            "Cache-Control":
              "no-store",

            "Set-Cookie":
              "__Host-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
          }
        }
      );
    }


    // --------------------------------------------------
    // 5. Perfil mínimo autenticado
    // --------------------------------------------------

    return new Response(
      JSON.stringify({

        authenticated:
          true,

        issuer:
          session.issuer,

        subject:
          session.subject,

        email:
          session.email,

        displayName:
          session.display_name

      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",

          "Cache-Control":
            "no-store"
        }
      }
    );


  } catch (err) {

    console.error(
      "Erro em /api/me:",
      err
    );


    return new Response(
      JSON.stringify({
        error:
          "Erro interno ao consultar a sessão."
      }),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json",

          "Cache-Control":
            "no-store"
        }
      }
    );
  }
}
