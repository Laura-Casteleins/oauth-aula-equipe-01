import { parse, serialize } from "https://deno.land/std@0.168.0/http/cookie.ts";

export function getCookie(req, name) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  return cookies[name] || null;
}

export function setCookie(resHeaders, name, value, options = {}) {
  const cookieString = serialize(name, value, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    ...options,
  });
  resHeaders.append("Set-Cookie", cookieString);
}
