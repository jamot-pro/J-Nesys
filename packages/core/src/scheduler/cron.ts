const RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
];

function fieldMatches(
  field: string,
  value: number,
  range: readonly [number, number],
): boolean {
  const [min] = range;
  for (const part of field.split(",")) {
    if (part === "*") return true;

    let base = part;
    let step: number | undefined;
    const slash = part.indexOf("/");
    if (slash !== -1) {
      base = part.slice(0, slash);
      const parsed = Number(part.slice(slash + 1));
      if (!Number.isInteger(parsed) || parsed <= 0) return false;
      step = parsed;
    }

    if (base === "*") {
      if (step !== undefined && (value - min) % step === 0) return true;
      continue;
    }

    const dash = base.indexOf("-");
    if (dash !== -1) {
      const a = Number(base.slice(0, dash));
      const b = Number(base.slice(dash + 1));
      if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
      if (step !== undefined) {
        if (value >= a && value <= b && (value - a) % step === 0) return true;
        continue;
      }
      if (value >= a && value <= b) return true;
      continue;
    }

    const n = Number(base);
    if (!Number.isInteger(n)) return false;
    if (step !== undefined) {
      if (value >= n && (value - n) % step === 0) return true;
      continue;
    }
    if (n === value) return true;
  }
  return false;
}

export function cronMatches(cron: string, date: Date): boolean {
  if (typeof cron !== "string") return false;
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const values = [
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    date.getDay(),
  ];

  for (let i = 0; i < 5; i++) {
    const field = fields[i];
    const range = RANGES[i];
    if (field === undefined || range === undefined) return false;
    if (!fieldMatches(field, values[i] ?? 0, range)) return false;
  }
  return true;
}

function partIsValid(
  part: string,
  range: readonly [number, number],
): boolean {
  const [min, max] = range;
  if (part === "*") return true;

  let base = part;
  let step: number | undefined;
  const slash = part.indexOf("/");
  if (slash !== -1) {
    base = part.slice(0, slash);
    const parsed = Number(part.slice(slash + 1));
    if (!Number.isInteger(parsed) || parsed <= 0) return false;
    step = parsed;
  }

  if (base === "*") return true;

  const dash = base.indexOf("-");
  if (dash !== -1) {
    const a = Number(base.slice(0, dash));
    const b = Number(base.slice(dash + 1));
    if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
    if (a < min || b > max || a > b) return false;
    return true;
  }

  const n = Number(base);
  if (!Number.isInteger(n)) return false;
  return n >= min && n <= max;
}

export function cronIsValid(cron: string): boolean {
  if (typeof cron !== "string" || cron.trim() === "") return false;
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  for (let i = 0; i < 5; i++) {
    const field = fields[i];
    const range = RANGES[i];
    if (field === undefined || range === undefined) return false;
    for (const part of field.split(",")) {
      if (!partIsValid(part, range)) return false;
    }
  }
  return true;
}
