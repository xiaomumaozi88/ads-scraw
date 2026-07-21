const DEFAULT_API_BASE = '/api';

function stripTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function resolveApiBase() {
  const fromEnv = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL);
  return fromEnv || DEFAULT_API_BASE;
}

export const API_BASE = resolveApiBase();
