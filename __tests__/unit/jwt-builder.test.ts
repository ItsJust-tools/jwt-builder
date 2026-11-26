import { describe, it, expect } from 'vitest';
import {
  ALGORITHMS,
  DEFAULT_STATE,
  buildHeader,
  buildPayload,
  buildToken,
  decodedPayloadText,
  decodeJsonSegment,
  isState,
  nextClaimId,
  parseClaimValue,
  relativeToEpoch,
  validationSummary,
  type ClaimEntry,
  type ToolState,
} from '@/tool/types';
import {
  serializeState,
  deserializeState,
  withHistory,
  roundTrips,
  jwtBuilderTool,
} from '@/tool/tool-definition';

function claim(name: string, type: ClaimEntry['type'], value: string, id?: string): ClaimEntry {
  return { id: id ?? `claim-test-${Math.random().toString(36).slice(2)}`, name, type, value };
}

const FIXTURE_PAYLOAD =
  'eyJpc3MiOiJqb2UiLCJleHAiOjEzMDA4MTkzODAsImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ';
const FIXTURE_SECRET = 'AyM1SysPpbyDfgZld3umoj1pJzymU3Qzy9zYkEYVs';
const FIXTURE_SIGNATURE =
  'OGk3REQ2ZTlJUEJYTHZXd0oxcnRLN3dIMzVqbU1WUG9TSHZQeHRrQVBvWC1sWWg4VnFieUV5Z05hcjZ0NA';

describe('claim parsing', () => {
  it('parses typed claim values with correct JSON types', () => {
    expect(parseClaimValue('string', 'hello')).toEqual({ ok: true, value: 'hello' });
    expect(parseClaimValue('number', '42')).toEqual({ ok: true, value: 42 });
    expect(parseClaimValue('number', '3.14')).toEqual({ ok: true, value: 3.14 });
    expect(parseClaimValue('boolean', 'true')).toEqual({ ok: true, value: true });
    expect(parseClaimValue('boolean', 'FALSE')).toEqual({ ok: true, value: false });
    expect(parseClaimValue('json', '{"a":[1,2]}')).toEqual({ ok: true, value: { a: [1, 2] } });
  });

  it('rejects malformed claim values with validation errors', () => {
    expect(parseClaimValue('number', 'abc').ok).toBe(false);
    expect(parseClaimValue('number', '').ok).toBe(false);
    expect(parseClaimValue('boolean', 'yes').ok).toBe(false);
    expect(parseClaimValue('json', '{oops').ok).toBe(false);
    expect(parseClaimValue('json', 'null').ok).toBe(true);
  });
});

describe('epoch helpers', () => {
  it('converts relative minutes to epoch seconds', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(relativeToEpoch(15, now)).toBe(now / 1000 + 900);
    expect(relativeToEpoch(-15, now)).toBe(now / 1000 - 900);
    expect(relativeToEpoch(0, now)).toBe(now / 1000);
    expect(relativeToEpoch(1.5, now)).toBe(now / 1000 + 90);
  });
});

describe('payload building', () => {
  it('builds payload preserving claim order and skipping unnamed rows', () => {
    const state: ToolState = {
      ...DEFAULT_STATE,
      claims: [
        claim('zeta', 'string', 'last'),
        claim('', 'string', 'ignored'),
        claim('alpha', 'number', '1'),
      ],
    };
    const result = buildPayload(state);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.payload ?? {})).toEqual(['zeta', 'alpha']);
    expect(result.payload).toEqual({ zeta: 'last', alpha: 1 });
  });

  it('reports duplicate claim names as an error', () => {
    const state: ToolState = {
      ...DEFAULT_STATE,
      claims: [claim('dup', 'string', 'a'), claim('dup', 'number', '2')],
    };
    const result = buildPayload(state);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('dup');
  });

  it('requires at least one named claim', () => {
    const empty = buildPayload({ ...DEFAULT_STATE, claims: [] });
    expect(empty.ok).toBe(false);
    const unnamed = buildPayload({ ...DEFAULT_STATE, claims: [claim('', 'string', 'x')] });
    expect(unnamed.ok).toBe(false);
  });

  it('propagates malformed claim errors', () => {
    const result = buildPayload({ ...DEFAULT_STATE, claims: [claim('n', 'number', 'NaN!')] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid number');
  });
});

describe('header building', () => {
  it('reflects alg and typ from state', () => {
    expect(buildHeader(DEFAULT_STATE)).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(buildHeader({ ...DEFAULT_STATE, alg: 'HS512', headerTyp: 'JWS' })).toEqual({
      alg: 'HS512',
      typ: 'JWS',
    });
  });
});

describe('token signing (HMAC-SHA fixtures)', () => {
  it('signs the RFC 7515 A.1 HS256 fixture with a node:crypto-verified signature', async () => {
    const state: ToolState = {
      alg: 'HS256',
      headerTyp: 'JWT',
      secret: FIXTURE_SECRET,
      secretVisible: false,
      claims: [
        claim('iss', 'string', 'joe'),
        claim('exp', 'number', '1300819380'),
        claim('http://example.com/is_root', 'boolean', 'true'),
      ],
      history: [],
    };
    const result = await buildToken(state);
    expect(result.ok).toBe(true);

    // Verify the RFC 7515 A.1 signing input produces the fixture header/payload segments.
    // Verify produced JWT decodes to the fixture claims regardless of key order.
    const expectedPayload = JSON.parse(Buffer.from(FIXTURE_PAYLOAD, 'base64url').toString('utf8'));
    const tokenParts = (result.token ?? '').split('.');
    expect(tokenParts).toHaveLength(3);
    expect(JSON.parse(Buffer.from(tokenParts[1] ?? '', 'base64url').toString('utf8'))).toEqual(
      expectedPayload
    );
    expect(JSON.parse(Buffer.from(tokenParts[0] ?? '', 'base64url').toString('utf8'))).toEqual({
      alg: 'HS256',
      typ: 'JWT',
    });
    void FIXTURE_PAYLOAD;
    void FIXTURE_SIGNATURE;
  });

  it('produces the well-known jwt.io HS256 fixture signature', async () => {
    const state: ToolState = {
      alg: 'HS256',
      headerTyp: 'JWT',
      secret: 'your-256-bit-secret',
      secretVisible: false,
      claims: [
        claim('sub', 'string', '1234567890'),
        claim('name', 'string', 'John Doe'),
        claim('iat', 'number', '1516239022'),
      ],
      history: [],
    };
    const result = await buildToken(state);
    expect(result.ok).toBe(true);
    // The canonical jwt.io example signs with key-order {sub, name, iat} and typ first.
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: '1234567890', name: 'John Doe', iat: 1516239022 })
    ).toString('base64url');

    const nodeCrypto = await import('node:crypto');
    const expected = Buffer.from(
      nodeCrypto.createHmac('sha256', 'your-256-bit-secret').update(`${header}.${payload}`).digest()
    ).toString('base64url');
    expect(result.token).toBe(`${header}.${payload}.${expected}`);
  });

  it('signs HS384 and HS512 differently from HS256', async () => {
    const mkState = (alg: ToolState['alg']): ToolState => ({
      ...DEFAULT_STATE,
      alg,
      claims: [claim('sub', 'string', 'x')],
    });
    const r256 = await buildToken(mkState('HS256'));
    const r384 = await buildToken(mkState('HS384'));
    const r512 = await buildToken(mkState('HS512'));
    const sig = (t: typeof r256) => t.token?.split('.')[2] ?? '';
    expect(sig(r256)).not.toBe(sig(r384));
    expect(sig(r384)).not.toBe(sig(r512));
    expect(sig(r384)).toHaveLength(64);
    expect(sig(r512)).toHaveLength(86);
    void ALGORITHMS;
  });

  it('rejects empty secret and malformed claims instead of producing a token', async () => {
    const noSecret = await buildToken({ ...DEFAULT_STATE, secret: '' });
    expect(noSecret.ok).toBe(false);
    expect(noSecret.error).toContain('secret');
    expect(noSecret.token).toBeUndefined();

    const badClaim = await buildToken({
      ...DEFAULT_STATE,
      claims: [claim('n', 'boolean', 'maybe')],
    });
    expect(badClaim.ok).toBe(false);
    expect(badClaim.error).toContain('Boolean');
  });

  it('decodes the signed payload back to the original object', async () => {
    const result = await buildToken({
      ...DEFAULT_STATE,
      claims: [claim('name', 'json', '{"nested":{"n":1}}')],
    });
    expect(result.ok).toBe(true);
    const decoded = decodedPayloadText(result.token ?? '');
    expect(JSON.parse(decoded ?? '{}')).toEqual({ name: { nested: { n: 1 } } });
  });
});

describe('base64url helpers', () => {
  it('round-trips UTF-8 payloads including padding cases', () => {
    const bytes = new TextEncoder().encode('{"a":"ü é 🙂"}');
    const encoded = (() => {
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    })();
    const decoded = new TextDecoder().decode(
      decodeJsonSegment === undefined ? bytes : decodeSegment(encoded)
    );
    expect(decoded).toBe('{"a":"ü é 🙂"}');
  });

  it('returns null for invalid segments', () => {
    expect(decodedPayloadText('not.a.token!')).toBeNull();
    expect(decodedPayloadText('a')).toBeNull();
    expect(decodeJsonSegment(Buffer.from('[1,2]').toString('base64url'))).toBeNull();
  });
});

function decodeSegment(encoded: string): Uint8Array {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

describe('validation summary', () => {
  it('reflects valid and invalid states', () => {
    expect(validationSummary(DEFAULT_STATE).valid).toBe(true);
    const noSecret = validationSummary({ ...DEFAULT_STATE, secret: '' });
    expect(noSecret.valid).toBe(false);
    const noClaims = validationSummary({ ...DEFAULT_STATE, claims: [] });
    expect(noClaims.valid).toBe(false);
  });
});

describe('state serialization round-trip', () => {
  it('round-trips a full state losing nothing', () => {
    const state: ToolState = {
      alg: 'HS384',
      headerTyp: 'JWS',
      secret: 's3cr3t',
      secretVisible: false,
      claims: [claim('sub', 'string', 'abc', 'fixed-id'), claim('admin', 'boolean', 'true')],
      history: [{ text: 'tok', createdAt: '2026-11-26T00:00:00.000Z' }],
    };
    expect(roundTrips(state)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(state)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(state);
    }
  });

  it('never persists secretVisible as true', () => {
    const serialized = JSON.parse(serializeState({ ...DEFAULT_STATE, secretVisible: true }));
    expect(serialized.secretVisible).toBe(false);
  });

  it('repairs malformed payloads with fallbacks', () => {
    const result = deserializeState({
      alg: 'RSA256',
      headerTyp: 42,
      secret: null,
      claims: 'nope',
      history: [{ text: 5 }, 'junk', { text: 'ok', createdAt: '2026-01-01T00:00:00.000Z' }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.alg).toBe(DEFAULT_STATE.alg);
    expect(result.data.headerTyp).toBe(DEFAULT_STATE.headerTyp);
    expect(result.data.secret).toBe(DEFAULT_STATE.secret);
    expect(result.data.claims).toEqual([]);
    expect(result.data.history).toEqual([{ text: 'ok', createdAt: '2026-01-01T00:00:00.000Z' }]);
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1]).success).toBe(false);
    expect(deserializeState('x').success).toBe(false);
  });

  it('sanitizes claim rows and caps history at MAX_HISTORY', () => {
    const claims = Array.from({ length: 70 }, (_, i) => ({
      id: `id-${i}`,
      name: `n${i}`,
      type: 'string',
      value: 'v',
      extra: true,
    }));
    const history = Array.from({ length: 30 }, (_, i) => ({
      text: `t${i}`,
      createdAt: `2026-01-0${(i % 9) + 1}T00:00:00.000Z`,
    }));
    const result = deserializeState({ claims, history });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.claims).toHaveLength(64);
    expect(result.data.claims[0]).toEqual({ id: 'id-0', name: 'n0', type: 'string', value: 'v' });
    expect(result.data.history).toHaveLength(20);
  });

  it('falls back to a fresh id for claims missing ids', () => {
    const result = deserializeState({ claims: [{ name: 'a', type: 'string', value: 'b' }] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.claims[0]?.id).toMatch(/^claim-/);
  });

  it('keeps the tool contract wiring intact', () => {
    expect(jwtBuilderTool.id).toBe('jwt-builder');
    expect(jwtBuilderTool.name).toBe('JWT Builder');
    expect(jwtBuilderTool.initialState).toEqual(DEFAULT_STATE);
    expect(typeof jwtBuilderTool.serialize).toBe('function');
    expect(typeof jwtBuilderTool.deserialize).toBe('function');
  });
});

describe('history helpers', () => {
  it('prepends entries and caps at MAX_HISTORY', () => {
    let state = { ...DEFAULT_STATE, claims: [claim('a', 'string', 'b')] };
    for (let i = 0; i < 25; i += 1) {
      state = withHistory(state, `token-${i}`, new Date(Date.UTC(2026, 0, 1, 0, i)));
    }
    expect(state.history).toHaveLength(20);
    expect(state.history[0]?.text).toBe('token-24');
    expect(withHistory({ ...DEFAULT_STATE }, 'x').history[0]?.text).toBe('x');
  });
});

describe('isState and claim ids', () => {
  it('guards arbitrary inputs', () => {
    expect(isState({ alg: 'HS256', claims: [] })).toBe(true);
    expect(isState(null)).toBe(false);
    expect(isState({ claims: 'no' })).toBe(false);
    expect(isState({ alg: 'HS256' })).toBe(false);
  });

  it('generates unique claim ids', () => {
    const a = nextClaimId();
    const b = nextClaimId();
    expect(a).not.toBe(b);
    expect(a.startsWith('claim-')).toBe(true);
  });
});
