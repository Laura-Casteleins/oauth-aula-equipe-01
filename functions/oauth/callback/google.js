import {
  sha256Base64Url,
  randomBase64Url
} from "../../_shared/crypto.js";

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");

    if (key === name) {
      return valueParts.join("=");
    }
  }

  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  try {
    // --------------------------------------------------
    // 1. Recusar erro retornado pelo Google
    // --------------------------------------------------

    if (error) {
      return new Response(
        "Autenticação recusada pelo provedor.",
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store"
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
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // --------------------------------------------------
    // 3. Exigir cookie temporário
    // --------------------------------------------------

    const transactionId =
      getCookie(request, "__Host-oauth-tx");

    if (!transactionId) {
      return new Response(
        "Transação OAuth ausente.",
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // --------------------------------------------------
    // 4. Calcular hashes
    // --------------------------------------------------

    const transactionIdHash =
      await sha256Base64Url(transactionId);

    const stateHash =
      await sha256Base64Url(state);

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
            AND provider = 'google'
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
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // --------------------------------------------------
    // 6. Validar state
    // --------------------------------------------------

    if (transaction.state_hash !== stateHash) {
      return new Response(
        "State inválido.",
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // --------------------------------------------------
    // 7. Apagar transação ANTES da troca
    // --------------------------------------------------

    await env.DB
      .prepare(`
        DELETE FROM oauth_transactions
        WHERE id_hash = ?
      `)
      .bind(transactionIdHash)
      .run();

    // --------------------------------------------------
    // 8. Trocar código pelo token usando PKCE
    // --------------------------------------------------

    const tokenResponse =
      await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body: new URLSearchParams({
            client_id:
              env.GOOGLE_CLIENT_ID,

            client_secret:
              env.GOOGLE_CLIENT_SECRET,

            code,

            code_verifier:
              transaction.code_verifier,

            grant_type:
              "authorization_code",

            redirect_uri:
              `${env.PUBLIC_BASE_URL}/oauth/callback/google`
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
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // --------------------------------------------------
    // Por enquanto paramos aqui.
    // O próximo passo será validar o id_token
    // criptograficamente, conforme o PDF.
    // --------------------------------------------------

    if (!tokens.id_token) {
      return new Response(
        "id_token não recebido.",
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        message:
          "PKCE, state e troca do código funcionaram corretamente."
      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",

          "Cache-Control":
            "no-store",

          "Set-Cookie":
            "__Host-oauth-tx=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        }
      }
    );

  } catch (err) {
    console.error(
      "Erro no callback Google:",
      err
    );

    return new Response(
      "Erro interno durante autenticação.",
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }
}
