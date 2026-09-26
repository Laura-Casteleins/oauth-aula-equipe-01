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


export async function onRequestPost(context) {

  const { request, env } = context;

  try {

    // --------------------------------------------------
    // 1. Validar Origin
    // --------------------------------------------------

    const origin =
      request.headers.get("Origin");

    if (
      !origin ||
      origin !== env.PUBLIC_BASE_URL
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Origem inválida."
        }),
        {
          status: 403,

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
    // 2. Ler cookie da sessão
    // --------------------------------------------------

    const sessionId =
      getCookie(
        request,
        "__Host-session"
      );


    // --------------------------------------------------
    // 3. Se houver sessão, remover do D1
    // --------------------------------------------------

    if (sessionId) {

      const sessionIdHash =
        await sha256Base64Url(
          sessionId
        );

      await env.DB
        .prepare(`
          DELETE FROM sessions
          WHERE id_hash = ?
        `)
        .bind(
          sessionIdHash
        )
        .run();
    }


    // --------------------------------------------------
    // 4. Expirar cookie da sessão
    // --------------------------------------------------

    const headers =
      new Headers();

    headers.set(
      "Location",
      env.PUBLIC_BASE_URL
    );

    headers.set(
      "Cache-Control",
      "no-store"
    );

    headers.append(
      "Set-Cookie",
      "__Host-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
    );


    // --------------------------------------------------
    // 5. Voltar para a página inicial
    // --------------------------------------------------

    return new Response(
      null,
      {
        status: 303,
        headers
      }
    );


  } catch (err) {

    console.error(
      "Erro no logout:",
      err
    );

    return new Response(
      JSON.stringify({
        error:
          "Erro interno durante logout."
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
