import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Display-only phone formatting: stored phone numbers are bare digits
 * (WhatsApp JIDs, Google contacts — both normalized the same way for
 * matching), so this never touches what's stored, only how it renders.
 *
 * A WhatsApp "lid" (a privacy-linked device id WhatsApp substitutes for the
 * real number in some cases) is 13+ digits — too long to be a real phone
 * number, so those are left as-is rather than mangled into a fake "+" number.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length > 15) return phone;
  return `+${digits}`;
}
