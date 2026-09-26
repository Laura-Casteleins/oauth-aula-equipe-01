import {
  randomBase64Url,
  sha256Base64Url,
} from "../../_shared/crypto.js";

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // --------------------------------------------------
    // 1. Gerar valores aleatórios
    // --------------------------------------------------

    const transactionId = randomBase64Url(32);
    const state = randomBase64Url(32);
    const codeVerifier = randomBase64Url(32);

    // --------------------------------------------------
    // 2. Criar os resumos
    // --------------------------------------------------

    const transactionIdHash =
      await sha256Base64Url(transactionId);

    const stateHash =
      await sha256Base64Url(state);

    const codeChallenge =
      await sha256Base64Url(codeVerifier);

    // --------------------------------------------------
    // 3. Validade: 10 minutos
    // --------------------------------------------------

    const expiresAt =
      Math.floor(Date.now() / 1000) + 600;

    // --------------------------------------------------
    // 4. Registrar transação no D1
    //
    // GitHub NÃO utiliza nonce neste laboratório.
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
        "github",
        stateHash,
        null,
        codeVerifier,
        expiresAt
      )
      .run();

    // --------------------------------------------------
    // 5. URL de callback
    // --------------------------------------------------

    const redirectUri =
      `${env.PUBLIC_BASE_URL}/oauth/callback/github`;

    // --------------------------------------------------
    // 6. Criar pedido de autorização
    // --------------------------------------------------

    const authorizationUrl =
      new URL(
        "https://github.com/login/oauth/authorize"
      );

    authorizationUrl.searchParams.set(
      "client_id",
      env.GITHUB_CLIENT_ID
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
      "state",
      state
    );

    authorizationUrl.searchParams.set(
      "code_challenge",
      codeChallenge
    );

    authorizationUrl.searchParams.set(
      "code_challenge_method",
      "S256"
    );

    /*
     * IMPORTANTE:
     *
     * Não adicionar:
     *
     * scope
     * nonce
     *
     * Conforme solicitado pelo professor.
     */

    // --------------------------------------------------
    // 7. Cookie temporário
    // --------------------------------------------------

    const cookie =
      `__Host-oauth-tx=${transactionId}; ` +
      `Path=/; ` +
      `HttpOnly; ` +
      `Secure; ` +
      `SameSite=Lax; ` +
      `Max-Age=600`;

    // --------------------------------------------------
    // 8. Redirecionamento
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
      "Erro ao iniciar login GitHub:",
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
