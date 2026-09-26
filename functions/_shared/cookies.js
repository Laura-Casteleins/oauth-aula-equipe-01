export function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...valueParts] =
      cookie.trim().split("=");

    if (key === name) {
      return valueParts.join("=");
    }
  }

  return null;
}

export function clearOAuthTransactionCookie() {
  return (
    "__Host-oauth-tx=; " +
    "Path=/; " +
    "HttpOnly; " +
    "Secure; " +
    "SameSite=Lax; " +
    "Max-Age=0"
  );
}

export function clearSessionCookie() {
  return (
    "__Host-session=; " +
    "Path=/; " +
    "HttpOnly; " +
    "Secure; " +
    "SameSite=Strict; " +
    "Max-Age=0"
  );
}
