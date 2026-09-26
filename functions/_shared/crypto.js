// functions/_shared/crypto.js

/*Gera bytes aleatórios criptograficamente seguros e converte para Base64URL sem preenchimento.*/
export function randomBase64Url(bytes = 32) {
  const randomBytes = new Uint8Array(bytes);
  crypto.getRandomValues(randomBytes);

  return base64UrlEncode(randomBytes);
}

/*Calcula SHA-256 de um texto.*/
export async function sha256(value) {
  const data = new TextEncoder().encode(value);

  return await crypto.subtle.digest("SHA-256", data);
}

/*Converte ArrayBuffer ou Uint8Array para Base64URL sem "=" no final.*/
export function base64UrlEncode(buffer) {
  const bytes =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/*Calcula o SHA-256 e devolve em Base64URL.*/
export async function sha256Base64Url(value) {
  const digest = await sha256(value);

  return base64UrlEncode(digest);
}
