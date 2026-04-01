import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { registerLegalRoutes } from "./legal.js";

describe("legal routes", () => {
  it("returns terms, privacy, retention and index without database", async () => {
    const app = Fastify({ logger: false });
    await registerLegalRoutes(app);

    const terms = await app.inject({ method: "GET", url: "/legal/terms" });
    assert.equal(terms.statusCode, 200);
    const t = terms.json() as { title: string; sections: unknown[] };
    assert.ok(t.title);
    assert.ok(Array.isArray(t.sections));

    const privacy = await app.inject({ method: "GET", url: "/legal/privacy" });
    assert.equal(privacy.statusCode, 200);

    const retention = await app.inject({ method: "GET", url: "/legal/retention" });
    assert.equal(retention.statusCode, 200);

    const idx = await app.inject({ method: "GET", url: "/legal" });
    assert.equal(idx.statusCode, 200);
    const list = idx.json() as { documents: { path: string }[] };
    assert.ok(list.documents.length >= 3);
  });
});
