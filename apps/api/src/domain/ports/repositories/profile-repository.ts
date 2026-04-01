export interface IProfileRepository {
  findById(userId: string): Promise<Record<string, unknown> | null>;
  updateById(userId: string, updates: string[], values: Array<string | number | null>): Promise<void>;
}
