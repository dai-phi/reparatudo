import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requestPasswordReset } from "./request-password-reset.js";
import type { IUserRepository } from "../../domain/ports/repositories/user-repository.js";
import type { IEmailSender } from "../../domain/ports/email-sender.js";
import type { IPasswordResetTokenStore } from "../../domain/ports/password-reset-token-store.js";

describe("requestPasswordReset", () => {
  it("does not send email or store token when user is missing", async () => {
    const users = {
      async findByEmailLower() {
        return null;
      },
    } as unknown as IUserRepository;

    let sendCount = 0;
    const email = {
      async send() {
        sendCount += 1;
      },
    } as IEmailSender;

    let replaceCount = 0;
    const tokens = {
      async replaceForUser() {
        replaceCount += 1;
      },
      async consumeIfValid() {
        return null;
      },
    } as IPasswordResetTokenStore;

    await requestPasswordReset(
      { users, email, tokens, appPublicUrl: "http://localhost:5173" },
      { email: "nobody@example.com" }
    );

    assert.equal(sendCount, 0);
    assert.equal(replaceCount, 0);
  });
});
