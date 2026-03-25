export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Brazilian mobile/landline: 10 or 11 digits (DDD + number). */
export function isValidBrazilPhone(phone: string): boolean {
  const d = normalizePhoneDigits(phone);
  return d.length >= 10 && d.length <= 11;
}
