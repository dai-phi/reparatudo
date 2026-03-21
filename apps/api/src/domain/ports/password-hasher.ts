export interface IPasswordHasher {
  hash(secret: string): Promise<string>;
  verify(secret: string, hash: string): Promise<boolean>;
}
