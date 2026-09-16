/** Strips formatting so two spellings of the same number compare equal. Not full E.164 validation. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 6) return null;
  return digits.startsWith("+") ? digits : `+${digits}`;
}
