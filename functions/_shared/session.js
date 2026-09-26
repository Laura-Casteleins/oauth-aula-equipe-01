import {
  randomBase64Url,
  sha256Base64Url
} from "./crypto.js";

export async function createSession(env, identity) {
  const sessionId = randomBase64Url(32);

  const sessionIdHash =
    await sha256Base64Url(sessionId);

  const now =
    Math.floor(Date.now() / 1000);

  const expiresAt =
    now + 28800; // 8 horas

  await env.DB
    .prepare(`
      INSERT INTO sessions (
        id_hash,
        issuer,
        subject,
        email,
        display_name,
        expires_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      sessionIdHash,
      identity.issuer,
      identity.subject,
      identity.email ?? null,
      identity.displayName ?? null,
      expiresAt,
      now
    )
    .run();

  const cookie =
    `__Host-session=${sessionId}; ` +
    `Path=/; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=Strict; ` +
    `Max-Age=28800`;

  return {
    cookie,
    expiresAt
  };
}
