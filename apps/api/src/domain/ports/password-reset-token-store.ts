export type PasswordResetTokenInsert = {
  userId: string;
  tokenHash: string;
  expiresAtIso: string;
  createdAtIso: string;
};

export interface IPasswordResetTokenStore {
  replaceForUser(input: PasswordResetTokenInsert): Promise<void>;
  /** Deletes the row and returns user id if token is valid and not expired. */
  consumeIfValid(tokenHash: string): Promise<string | null>;
}
