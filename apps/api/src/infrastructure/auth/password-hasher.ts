import bcrypt from "bcryptjs";
import type { IPasswordHasher } from "../../domain/ports/password-hasher.js";

export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(secret: string): Promise<string> {
    return bcrypt.hash(secret, 10);
  }

  async verify(secret: string, hash: string): Promise<boolean> {
    return bcrypt.compare(secret, hash);
  }
}
