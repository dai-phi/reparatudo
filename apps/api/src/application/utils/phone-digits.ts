/** Normalizes a Brazilian phone input to digits only for comparison and uniqueness checks. */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
