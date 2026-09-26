function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);

  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/") + padding;

  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function decodeJwtPart(value) {
  const bytes = base64UrlToUint8Array(value);

  const text = new TextDecoder().decode(bytes);

  return JSON.parse(text);
}

export async function validateGoogleIdToken({
  idToken,
  clientId,
  expectedNonce
}) {
  // --------------------------------------------------
  // 1. Separar as três partes do JWT
  // --------------------------------------------------

  const parts = idToken.split(".");

  if (parts.length !== 3) {
    throw new Error("Formato JWT inválido.");
  }

  const [
    encodedHeader,
    encodedPayload,
    encodedSignature
  ] = parts;

  // --------------------------------------------------
  // 2. Decodificar header e payload
  // --------------------------------------------------

  const header = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);

  // --------------------------------------------------
  // 3. Exigir RS256
  // --------------------------------------------------

  if (header.alg !== "RS256") {
    throw new Error("Algoritmo JWT inválido.");
  }

  if (!header.kid) {
    throw new Error("JWT sem kid.");
  }

  // --------------------------------------------------
  // 4. Obter documento de descoberta OIDC
  // --------------------------------------------------

  const discoveryResponse = await fetch(
    "https://accounts.google.com/.well-known/openid-configuration",
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );

  if (!discoveryResponse.ok) {
    throw new Error(
      "Não foi possível obter o documento OIDC."
    );
  }

  const discovery =
    await discoveryResponse.json();

  if (!discovery.jwks_uri) {
    throw new Error(
      "jwks_uri ausente no documento OIDC."
    );
  }

  // --------------------------------------------------
  // 5. Obter JWKS
  // --------------------------------------------------

  const jwksResponse =
    await fetch(discovery.jwks_uri);

  if (!jwksResponse.ok) {
    throw new Error(
      "Não foi possível obter as chaves JWKS."
    );
  }

  const jwks =
    await jwksResponse.json();

  // --------------------------------------------------
  // 6. Selecionar chave pelo kid
  // --------------------------------------------------

  const jwk =
    jwks.keys?.find(
      (key) =>
        key.kid === header.kid &&
        key.kty === "RSA"
    );

  if (!jwk) {
    throw new Error(
      "Chave pública correspondente não encontrada."
    );
  }

  // --------------------------------------------------
  // 7. Importar JWK
  // --------------------------------------------------

  const publicKey =
    await crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256"
      },
      false,
      ["verify"]
    );

  // --------------------------------------------------
  // 8. Verificar assinatura
  // --------------------------------------------------

  const signingInput =
    new TextEncoder().encode(
      `${encodedHeader}.${encodedPayload}`
    );

  const signature =
    base64UrlToUint8Array(
      encodedSignature
    );

  const validSignature =
    await crypto.subtle.verify(
      {
        name: "RSASSA-PKCS1-v1_5"
      },
      publicKey,
      signature,
      signingInput
    );

  if (!validSignature) {
    throw new Error(
      "Assinatura do id_token inválida."
    );
  }

  // --------------------------------------------------
  // 9. Validar claims
  // --------------------------------------------------

  const now =
    Math.floor(Date.now() / 1000);

  // iss
  const validIssuer =
    payload.iss === "https://accounts.google.com" ||
    payload.iss === "accounts.google.com";

  if (!validIssuer) {
    throw new Error(
      "Emissor do id_token inválido."
    );
  }

  // aud
  const audienceIsValid =
    Array.isArray(payload.aud)
      ? payload.aud.includes(clientId)
      : payload.aud === clientId;

  if (!audienceIsValid) {
    throw new Error(
      "Audiência do id_token inválida."
    );
  }

  // exp
  if (
    typeof payload.exp !== "number" ||
    payload.exp <= now
  ) {
    throw new Error(
      "id_token expirado."
    );
  }

  // iat
  if (
    typeof payload.iat !== "number" ||
    payload.iat > now + 300
  ) {
    throw new Error(
      "iat do id_token inválido."
    );
  }

  // nonce
  if (
    !expectedNonce ||
    payload.nonce !== expectedNonce
  ) {
    throw new Error(
      "Nonce do id_token inválido."
    );
  }

  // --------------------------------------------------
  // 10. Retornar identidade validada
  // --------------------------------------------------

  if (!payload.sub) {
    throw new Error(
      "id_token sem subject."
    );
  }

  return {
    issuer: payload.iss,
    subject: payload.sub,
    email:
      typeof payload.email === "string"
        ? payload.email
        : null,

    displayName:
      typeof payload.name === "string"
        ? payload.name
        : null,

    payload
  };
}
