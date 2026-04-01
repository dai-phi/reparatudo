import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildApp } from "./build-app.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe("auth HTTP (integration)", { skip: !hasDb }, () => {
  it("rejects invalid login payload with 400", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "invalid", password: "short" },
      });
      assert.equal(res.statusCode, 400);
    } finally {
      await app.close();
    }
  });

  it("returns 401 for unknown credentials without leaking user existence", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "nobody@example.com", password: "wrongpw" },
      });
      assert.equal(res.statusCode, 401);
      const body = res.json() as { message: string };
      assert.equal(body.message, "Credenciais invalidas");
    } finally {
      await app.close();
    }
  });
});
