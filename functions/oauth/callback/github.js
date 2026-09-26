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
    // 1. Recusar erro retornado pelo GitHub
    if (error) {
      return new Response(
        "Autenticação recusada pelo GitHub.",
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // 2. Exigir code e state
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

    // 3. Exigir cookie temporário
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

    // 4. Calcular hashes
    const transactionIdHash =
      await sha256Base64Url(transactionId);

    const stateHash =
      await sha256Base64Url(state);

    // 5. Buscar a transação no D1
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
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // 6. Validar state
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

    // 7. Apagar a transação antes da troca
    await env.DB
      .prepare(`
        DELETE FROM oauth_transactions
        WHERE id_hash = ?
      `)
      .bind(transactionIdHash)
      .run();

    // 8. Trocar o código pelo access_token
    const tokenResponse =
      await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",

          headers: {
            "Accept": "application/json",
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
            "Cache-Control": "no-store"
          }
        }
      );
    }

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

    // 9. Consultar o perfil autenticado
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
            "Cache-Control": "no-store"
          }
        }
      );
    }

    const profile =
      await profileResponse.json();

    if (!Number.isInteger(profile.id)) {
      return new Response(
        "Identidade GitHub inválida.",
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // --------------------------------------------------
    // Ainda NÃO criaremos a sessão.
    //
    // No próximo passo faremos a revogação da
    // autorização no GitHub antes da criação da sessão,
    // conforme exigido pelo professor.
    // --------------------------------------------------

    return new Response(
      JSON.stringify({
        status: "ok",
        message:
          "PKCE, state e consulta do perfil GitHub funcionaram corretamente.",
        subject:
          String(profile.id),
        displayName:
          profile.name ?? profile.login
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
      "Erro no callback GitHub:",
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
