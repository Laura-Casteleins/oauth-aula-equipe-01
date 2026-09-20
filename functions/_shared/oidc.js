export async function verifyIdToken(idToken, expectedClientId) {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Token ID inválido");
  }
  
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  
  if (payload.aud !== expectedClientId) {
    throw new Error("Audience inválido no token OIDC");
  }
  
  return payload;
}
