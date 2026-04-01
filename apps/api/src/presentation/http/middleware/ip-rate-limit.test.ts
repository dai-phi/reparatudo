import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createIpRateLimiter } from "./ip-rate-limit.js";

function mockRequest(ip: string): Pick<FastifyRequest, "ip" | "socket"> {
  return { ip, socket: { remoteAddress: ip } as FastifyRequest["socket"] };
}

describe("createIpRateLimiter", () => {
  it("allows requests up to max then returns 429", async () => {
    const limiter = createIpRateLimiter({ windowMs: 60_000, max: 2, routeKey: "t" });
    const req = mockRequest("10.0.0.1") as FastifyRequest;

    let status = 0;
    let body: unknown;
    const reply = {
      code(c: number) {
        status = c;
        return this;
      },
      send(b: unknown) {
        body = b;
        return this;
      },
    } as FastifyReply;

    await limiter(req, reply);
    assert.equal(status, 0);

    await limiter(req, reply);
    assert.equal(status, 0);

    await limiter(req, reply);
    assert.equal(status, 429);
    assert.ok(body && typeof body === "object" && "message" in (body as object));
  });

  it("isolates keys per route", async () => {
    const a = createIpRateLimiter({ windowMs: 60_000, max: 1, routeKey: "a" });
    const b = createIpRateLimiter({ windowMs: 60_000, max: 1, routeKey: "b" });
    const req = mockRequest("10.0.0.2") as FastifyRequest;

    let status = 0;
    const reply = {
      code(c: number) {
        status = c;
        return this;
      },
      send() {
        return this;
      },
    } as FastifyReply;

    await a(req, reply);
    assert.equal(status, 0);
    await b(req, reply);
    assert.equal(status, 0);
  });
});
