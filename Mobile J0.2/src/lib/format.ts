export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function displayName(person: { firstName: string | null; lastName: string | null } | null): string {
  if (!person) return "";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "You";
}
