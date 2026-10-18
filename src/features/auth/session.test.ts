import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, SESSION_MAX_AGE_SEC, verifySessionToken } from "./session";

describe("session token", () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = "secret";
    process.env.SESSION_SECRET = "salt";
  });

  it("принимает свежий токен", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it("отклоняет просроченный токен", async () => {
    const token = await createSessionToken(0);
    expect(await verifySessionToken(token, SESSION_MAX_AGE_SEC * 1000 + 1)).toBe(false);
  });

  it("отклоняет подделанный payload", async () => {
    const [, sig] = (await createSessionToken()).split(".");
    const forged = btoa(JSON.stringify({ exp: Date.now() * 2 })).replace(/=+$/, "");
    expect(await verifySessionToken(`${forged}.${sig}`)).toBe(false);
  });

  it("смена пароля инвалидирует сессии", async () => {
    const token = await createSessionToken();
    process.env.APP_PASSWORD = "other";
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("не падает на мусоре", async () => {
    expect(await verifySessionToken("garbage")).toBe(false);
    expect(await verifySessionToken("a.b")).toBe(false);
  });
});
