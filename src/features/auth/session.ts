// Работает и в Node, и в Edge-рантайме (middleware): только Web Crypto, без node:crypto.
// Сессия без хранения в БД: cookie = base64url(payload).base64url(HMAC-SHA256).

export const SESSION_COOKIE = "avetrack_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 90;

const encoder = new TextEncoder();

function getSecret(): string {
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD не задан в .env");
  // Пароль входит в ключ: смена пароля разлогинивает все устройства
  return `${process.env.SESSION_SECRET ?? ""}:${password}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ exp: now + SESSION_MAX_AGE_SEC * 1000 })),
  );
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string, now = Date.now()): Promise<boolean> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(signature),
      encoder.encode(payload),
    );
    if (!valid) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}
