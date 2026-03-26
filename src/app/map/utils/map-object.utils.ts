export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readPlainObject(value: unknown, errorMessage: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(errorMessage);
  }

  return value;
}

export function readOptionalPlainObject(value: unknown): Record<string, unknown> | undefined {
  return isPlainObject(value) ? value : undefined;
}

export function readOptionalArray<T = unknown>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? value as T[] : undefined;
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
