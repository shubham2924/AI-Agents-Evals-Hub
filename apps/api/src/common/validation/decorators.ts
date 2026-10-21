import { Transform } from 'class-transformer';

export const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
export const SAFE_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function Trim() {
  return Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
}

export function TrimStringArray() {
  return Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item.trim() : item)) : value,
  );
}
