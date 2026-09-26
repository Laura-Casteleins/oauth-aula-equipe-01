import {
  randomBase64Url,
  sha256Base64Url,
} from "../../_shared/crypto.js";

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // --------------------------------------------------
    // 1. Gerar os valores aleatórios da transação OAuth
    // --------------------------------------------------

    const transactionId = randomBase64Url(32);
    const state = randomBase64Url(32);
    const nonce = randomBase64Url(32);
    const codeVerifier = randomBase64Url(32);

    // --------------------------------------------------
    // 2. Criar os resumos SHA-256
    // --------------------------------------------------

    const transactionIdHash =
      await sha256Base64Url(transactionId);

    const stateHash =
      await sha256Base64Url(state);

    // PKCE S256
    const codeChallenge =
      await sha256Base64Url(codeVerifier);

    // --------------------------------------------------
    // 3. Definir validade da transação
    // 10 minutos = 600 segundos
    // --------------------------------------------------

    const expiresAt =
      Math.floor(Date.now() / 1000) + 600;

    // --------------------------------------------------
    // 4. Gravar a transação no D1
    // --------------------------------------------------

    await env.DB
      .prepare(`
        INSERT INTO oauth_transactions (
          id_hash,
          provider,
          state_hash,
          nonce,
          code_verifier,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        transactionIdHash,
        "google",
        stateHash,
        nonce,
        codeVerifier,
        expiresAt
      )
      .run();

    // --------------------------------------------------
    // 5. URL de callback
    // --------------------------------------------------

    const redirectUri =
      `${env.PUBLIC_BASE_URL}/oauth/callback/google`;

    // --------------------------------------------------
    // 6. Criar URL de autorização do Google
    // --------------------------------------------------

    const authorizationUrl =
      new URL(
        "https://accounts.google.com/o/oauth2/v2/auth"
      );

    authorizationUrl.searchParams.set(
      "client_id",
      env.GOOGLE_CLIENT_ID
    );

    authorizationUrl.searchParams.set(
      "redirect_uri",
      redirectUri
    );

    authorizationUrl.searchParams.set(
      "response_type",
      "code"
    );

    authorizationUrl.searchParams.set(
      "scope",
      "openid email profile"
    );

    authorizationUrl.searchParams.set(
      "state",
      state
    );

    authorizationUrl.searchParams.set(
      "nonce",
      nonce
    );

    authorizationUrl.searchParams.set(
      "code_challenge",
      codeChallenge
    );

    authorizationUrl.searchParams.set(
      "code_challenge_method",
      "S256"
    );

    // --------------------------------------------------
    // 7. Criar cookie temporário da transação
    // --------------------------------------------------

    const cookie =
      `__Host-oauth-tx=${transactionId}; ` +
      `Path=/; ` +
      `HttpOnly; ` +
      `Secure; ` +
      `SameSite=Lax; ` +
      `Max-Age=600`;

    // --------------------------------------------------
    // 8. Redirecionar para o Google
    // --------------------------------------------------

    return new Response(null, {
      status: 302,

      headers: {
        Location: authorizationUrl.toString(),
        "Set-Cookie": cookie,
        "Cache-Control": "no-store",
      },
    });

  } catch (error) {
    console.error(
      "Erro ao iniciar login Google:",
      error
    );

    return new Response(
      "Não foi possível iniciar a autenticação.",
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
