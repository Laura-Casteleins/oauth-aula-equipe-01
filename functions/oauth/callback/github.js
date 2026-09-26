import {
  sha256Base64Url
} from "../../_shared/crypto.js";

import {
  createSession
} from "../../_shared/session.js";


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

  const url =
    new URL(request.url);

  const error =
    url.searchParams.get("error");

  const code =
    url.searchParams.get("code");

  const state =
    url.searchParams.get("state");


  try {

    // --------------------------------------------------
    // 1. Recusar erro retornado pelo GitHub
    // --------------------------------------------------

    if (error) {
      return new Response(
        "Autenticação recusada pelo GitHub.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 2. Exigir code e state
    // --------------------------------------------------

    if (!code || !state) {
      return new Response(
        "Resposta OAuth inválida.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 3. Exigir cookie temporário
    // --------------------------------------------------

    const transactionId =
      getCookie(
        request,
        "__Host-oauth-tx"
      );


    if (!transactionId) {
      return new Response(
        "Transação OAuth ausente.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 4. Calcular hashes
    // --------------------------------------------------

    const transactionIdHash =
      await sha256Base64Url(
        transactionId
      );

    const stateHash =
      await sha256Base64Url(
        state
      );


    // --------------------------------------------------
    // 5. Buscar transação no D1
    // --------------------------------------------------

    const now =
      Math.floor(Date.now() / 1000);


    const transaction =
      await env.DB
        .prepare(`
          SELECT
            id_hash,
            provider,
            state_hash,
            nonce,
            code_verifier,
            expires_at

          FROM oauth_transactions

          WHERE id_hash = ?
            AND provider = 'github'
            AND expires_at > ?
        `)
        .bind(
          transactionIdHash,
          now
        )
        .first();


    if (!transaction) {
      return new Response(
        "Transação OAuth inválida ou expirada.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 6. Validar state
    // --------------------------------------------------

    if (
      transaction.state_hash !==
      stateHash
    ) {
      return new Response(
        "State inválido.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 7. Exigir code_verifier
    // --------------------------------------------------

    if (!transaction.code_verifier) {
      return new Response(
        "code_verifier ausente na transação.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 8. Apagar transação antes da conclusão
    // --------------------------------------------------

    await env.DB
      .prepare(`
        DELETE FROM oauth_transactions
        WHERE id_hash = ?
      `)
      .bind(transactionIdHash)
      .run();


    // --------------------------------------------------
    // 9. Trocar código pelo access_token
    // --------------------------------------------------

    const tokenResponse =
      await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",

          headers: {
            "Accept":
              "application/json",

            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body: new URLSearchParams({

            client_id:
              env.GITHUB_CLIENT_ID,

            client_secret:
              env.GITHUB_CLIENT_SECRET,

            code,

            redirect_uri:
              `${env.PUBLIC_BASE_URL}/oauth/callback/github`,

            code_verifier:
              transaction.code_verifier
          })
        }
      );


    const tokens =
      await tokenResponse.json();


    if (!tokenResponse.ok) {
      return new Response(
        "Falha na troca do código OAuth.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 10. Exigir access_token
    // --------------------------------------------------

    if (!tokens.access_token) {
      return new Response(
        JSON.stringify({
          error:
            tokens.error_description ??
            tokens.error ??
            "access_token não recebido."
        }),
        {
          status: 400,

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
    // 11. Exigir token_type Bearer
    // --------------------------------------------------

    if (
      typeof tokens.token_type !== "string" ||
      tokens.token_type.toLowerCase() !== "bearer"
    ) {
      return new Response(
        "token_type GitHub inválido.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 12. Consultar perfil autenticado
    // --------------------------------------------------

    const profileResponse =
      await fetch(
        "https://api.github.com/user",
        {
          headers: {

            "Authorization":
              `Bearer ${tokens.access_token}`,

            "Accept":
              "application/vnd.github+json",

            "X-GitHub-Api-Version":
              "2026-03-10",

            "User-Agent":
              "oauth-aula-equipe-01"
          }
        }
      );


    if (!profileResponse.ok) {
      return new Response(
        "Não foi possível confirmar a identidade no GitHub.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    const profile =
      await profileResponse.json();


    // --------------------------------------------------
    // 13. Exigir ID numérico estável
    // --------------------------------------------------

    if (!Number.isInteger(profile.id)) {
      return new Response(
        "Identidade GitHub inválida.",
        {
          status: 400,

          headers: {
            "Cache-Control":
              "no-store"
          }
        }
      );
    }


    // --------------------------------------------------
    // 14. Revogar autorização OAuth
    // --------------------------------------------------

    const basicCredentials =
      btoa(
        `${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`
      );


    const revokeResponse =
      await fetch(
        `https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/grant`,
        {
          method:
            "DELETE",

          headers: {

            "Authorization":
              `Basic ${basicCredentials}`,

            "Accept":
              "application/vnd.github+json",

            "X-GitHub-Api-Version":
              "2026-03-10",

            "Content-Type":
              "application/json",

            "User-Agent":
              "oauth-aula-equipe-01"
          },

          body:
            JSON.stringify({
              access_token:
                tokens.access_token
            })
        }
      );


    // --------------------------------------------------
    // 15. Exigir resposta 204
    // --------------------------------------------------

    if (
      revokeResponse.status !== 204
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Falha ao revogar autorização GitHub.",

          status:
            revokeResponse.status
        }),
        {
          status: 400,

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
    // 16. Montar identidade local
    // --------------------------------------------------

    const identity = {

      issuer:
        "https://github.com",

      subject:
        String(profile.id),

      email:
        typeof profile.email === "string"
          ? profile.email
          : null,

      displayName:
        profile.name ??
        profile.login
    };


    // --------------------------------------------------
    // 17. Criar sessão opaca local
    // --------------------------------------------------

    const session =
      await createSession(
        env,
        identity
      );


    // --------------------------------------------------
    // 18. Redirecionar para página inicial
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


    // Cookie da sessão
    headers.append(
      "Set-Cookie",
      session.cookie
    );


    // Apagar cookie OAuth temporário
    headers.append(
      "Set-Cookie",
      "__Host-oauth-tx=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );


    return new Response(
      null,
      {
        status: 302,
        headers
      }
    );


  } catch (err) {

    console.error(
      "Erro no callback GitHub:",
      err
    );


    return new Response(
      JSON.stringify({

        error:
          "Falha na autenticação GitHub.",

        detail:
          err.message

      }),
      {
        status: 400,

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
