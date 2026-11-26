export type HsAlg = 'HS256' | 'HS384' | 'HS512';

export type ClaimType = 'string' | 'number' | 'boolean' | 'json';

export interface ClaimEntry {
  /** Stable react key / entry identifier. */
  id: string;
  /** Claim name (key). Empty names are skipped when building the payload. */
  name: string;
  /** How the raw text value is interpreted when building JSON. */
  type: ClaimType;
  /** Raw text value; for `json` it must parse as valid JSON. */
  value: string;
}

export interface HistoryEntry {
  /** Short human readable description of the signed token. */
  text: string;
  /** ISO timestamp when the token was saved. */
  createdAt: string;
}

export interface ToolState {
  /** HMAC algorithm used to sign the token. */
  alg: HsAlg;
  /** JOSE header `typ` value. */
  headerTyp: string;
  /** Shared secret (HMAC key). */
  secret: string;
  /** Whether the secret input shows plain text. */
  secretVisible: boolean;
  /** Payload claim editor rows. */
  claims: ClaimEntry[];
  /** Saved tokens history, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  alg: 'HS256',
  headerTyp: 'JWT',
  secret: 'your-256-bit-secret',
  secretVisible: false,
  claims: [
    { id: 'claim-sub', name: 'sub', type: 'string', value: '1234567890' },
    { id: 'claim-name', name: 'name', type: 'string', value: 'John Doe' },
    { id: 'claim-iat', name: 'iat', type: 'number', value: '1516239022' },
  ],
  history: [],
};

export const MAX_HISTORY = 20;

export const ALGORITHMS: { value: HsAlg; bits: number; hash: 'SHA-256' | 'SHA-384' | 'SHA-512' }[] =
  [
    { value: 'HS256', bits: 256, hash: 'SHA-256' },
    { value: 'HS384', bits: 384, hash: 'SHA-384' },
    { value: 'HS512', bits: 512, hash: 'SHA-512' },
  ];

export const CLAIM_TYPES: { value: ClaimType; label: string }[] = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'json', label: 'JSON' },
];

/** Registered claims (RFC 7519 §4.1, plus jti from §4.1.7) with hints. */
export const REGISTERED_CLAIMS: { name: string; hint: string; suggestNumber: boolean }[] = [
  { name: 'iss', hint: 'principal that issued the JWT', suggestNumber: false },
  { name: 'sub', hint: 'principal that is the subject', suggestNumber: false },
  { name: 'aud', hint: 'recipients the JWT is intended for', suggestNumber: false },
  { name: 'exp', hint: 'expiration time (epoch seconds)', suggestNumber: true },
  { name: 'nbf', hint: 'not valid before (epoch seconds)', suggestNumber: true },
  { name: 'iat', hint: 'issued at (epoch seconds)', suggestNumber: true },
  { name: 'jti', hint: 'unique identifier for the JWT', suggestNumber: false },
];

/** Claims that are epoch seconds and can use the relative-time helpers. */
export const EPOCH_CLAIMS = ['exp', 'nbf', 'iat'];

let claimIdCounter = 0;

/** Fresh unique id for a new claim row. */
export function nextClaimId(): string {
  claimIdCounter += 1;
  return `claim-${Date.now().toString(36)}-${claimIdCounter}`;
}

export interface ClaimParseResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

/** Convert the raw text of a claim row into its typed JSON value. */
export function parseClaimValue(type: ClaimType, text: string): ClaimParseResult {
  switch (type) {
    case 'string':
      return { ok: true, value: text };
    case 'number': {
      const trimmed = text.trim();
      if (!trimmed) return { ok: false, error: 'Number claim requires a value' };
      const num = Number(trimmed);
      if (!Number.isFinite(num)) {
        return { ok: false, error: `Invalid number: "${text}"` };
      }
      return { ok: true, value: num };
    }
    case 'boolean': {
      const trimmed = text.trim().toLowerCase();
      if (trimmed === 'true') return { ok: true, value: true };
      if (trimmed === 'false') return { ok: true, value: false };
      return { ok: false, error: `Boolean claims accept only true or false: "${text}"` };
    }
    case 'json': {
      const trimmed = text.trim();
      if (!trimmed) return { ok: false, error: 'JSON claim requires content' };
      try {
        return { ok: true, value: JSON.parse(trimmed) };
      } catch {
        return { ok: false, error: `Invalid JSON: "${text}"` };
      }
    }
  }
}

/** Current epoch seconds. */
export function utcNowSeconds(now = Date.now()): number {
  return Math.floor(now / 1000);
}

/** Epoch seconds `minutes` from `now` (negative minutes go backwards). */
export function relativeToEpoch(minutes: number, now = Date.now()): number {
  return utcNowSeconds(now) + Math.round(minutes * 60);
}

export interface JwtHeaderObject {
  alg: HsAlg;
  typ: string;
}

/** Build the JOSE header object for the current state. */
export function buildHeader(state: ToolState): JwtHeaderObject {
  return { alg: state.alg, typ: state.headerTyp };
}

export interface PayloadResult {
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}

/**
 * Build the payload object from claim rows.
 * Row order is preserved; unnamed rows are skipped; empty payload counts as invalid.
 */
export function buildPayload(state: ToolState): PayloadResult {
  const payload: Record<string, unknown> = {};
  for (const claim of state.claims) {
    const name = claim.name.trim();
    if (!name) continue;
    if (Object.prototype.hasOwnProperty.call(payload, name)) {
      return { ok: false, error: `Duplicate claim name: ${name}` };
    }
    const parsed = parseClaimValue(claim.type, claim.value);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    payload[name] = parsed.value;
  }
  if (Object.keys(payload).length === 0) {
    return { ok: false, error: 'Add at least one named claim' };
  }
  return { ok: true, payload };
}

export interface TokenResult {
  ok: boolean;
  /** Dot-separated header.payload.token string. */
  token?: string;
  header?: JwtHeaderObject;
  payload?: Record<string, unknown>;
  error?: string;
}

function hashFor(alg: HsAlg): 'SHA-256' | 'SHA-384' | 'SHA-512' {
  return alg === 'HS256' ? 'SHA-256' : alg === 'HS384' ? 'SHA-384' : 'SHA-512';
}

/** URL-safe base64 of bytes (RFC 4648 §5, no padding). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Decode a URL-safe base64 segment back to bytes. */
export function base64UrlDecode(segment: string): Uint8Array {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** UTF-8 encoding of a JSON string as bytes. */
export function encodeJson(json: string): Uint8Array {
  return new TextEncoder().encode(json);
}

/** Sign data with the shared secret using the state's HMAC algorithm. */
export async function hmacSign(alg: HsAlg, data: Uint8Array, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encodeJson(secret) as unknown as BufferSource,
    { name: 'HMAC', hash: hashFor(alg) },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data as unknown as BufferSource);
  return new Uint8Array(signature);
}

/**
 * Build a signed JWT from the current state.
 * Returns a validation error when the secret is empty or a claim is malformed.
 */
export async function buildToken(state: ToolState, now = Date.now()): Promise<TokenResult> {
  if (!state.secret) {
    return { ok: false, error: 'Signing secret is required' };
  }
  const header = buildHeader(state);
  const payloadResult = buildPayload(state);
  if (!payloadResult.ok) {
    return { ok: false, error: payloadResult.error };
  }
  const headerSegment = base64UrlEncode(encodeJson(JSON.stringify(header)));
  const payloadSegment = base64UrlEncode(encodeJson(JSON.stringify(payloadResult.payload)));
  const alg = ALGORITHMS.find((a) => a.value === state.alg) ?? ALGORITHMS[0];
  if (!alg) {
    return { ok: false, error: 'Unsupported algorithm' };
  }
  try {
    const sig = await hmacSign(
      state.alg,
      encodeJson(`${headerSegment}.${payloadSegment}`),
      state.secret
    );
    const signature = base64UrlEncode(sig);
    void now;
    return {
      ok: true,
      token: `${headerSegment}.${payloadSegment}.${signature}`,
      header,
      payload: payloadResult.payload,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Signing failed',
    };
  }
}

/**
 * Synchronously validate claims + secret without producing a signature.
 * Used by status bar and preview gating.
 */
export function validationSummary(state: ToolState): { valid: boolean; message: string } {
  if (!state.secret) return { valid: false, message: 'Signing secret is required' };
  const payloadResult = buildPayload(state);
  return payloadResult.ok
    ? {
        valid: true,
        message: `${state.alg} · ${Object.keys(payloadResult.payload ?? {}).length} claims · ready to sign`,
      }
    : { valid: false, message: payloadResult.error ?? 'Invalid claims' };
}

/** Parse a decoded base64-url JSON segment, or return null. */
export function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const json = new TextDecoder().decode(base64UrlDecode(segment));
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Pretty-printed decoded payload of a dot-separated token, or null. */
export function decodedPayloadText(token: string): string | null {
  const [, payloadSegment, signatureSegment] = token.split('.');
  if (!signatureSegment) return null;
  const payload = payloadSegment ? decodeJsonSegment(payloadSegment) : null;
  return payload ? JSON.stringify(payload, null, 2) : null;
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.alg === 'string' &&
    Array.isArray(v.claims) &&
    (v.headerTyp === undefined || typeof v.headerTyp === 'string')
  );
}
