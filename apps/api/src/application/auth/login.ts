import type { IUserRepository } from "../../domain/ports/user-repository.js";
import type { IPasswordHasher } from "../../domain/ports/password-hasher.js";
import type { AuthFailure, AuthSuccess } from "./registerClient.js";

export async function login(
  deps: {
    users: IUserRepository;
    passwordHasher: IPasswordHasher;
  },
  input: { email: string; password: string }
): Promise<AuthSuccess | AuthFailure> {
  const email = input.email.toLowerCase();
  const user = await deps.users.findByEmailLower(email);

  if (!user) {
    return { status: 401, message: "Credenciais invalidas" };
  }

  const matches = await deps.passwordHasher.verify(input.password, user.passwordHash);
  if (!matches) {
    return { status: 401, message: "Credenciais invalidas" };
  }

  return {
    user,
    tokenPayload: { sub: user.id, role: user.role },
  };
}
