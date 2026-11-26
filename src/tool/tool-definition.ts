import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  ALGORITHMS,
  CLAIM_TYPES,
  DEFAULT_STATE,
  MAX_HISTORY,
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
  type ClaimType,
  type HsAlg,
  type HistoryEntry,
  type ToolState,
} from './types';

const VALID_ALGS: HsAlg[] = ALGORITHMS.map((a) => a.value);
const VALID_CLAIM_TYPES: ClaimType[] = CLAIM_TYPES.map((c) => c.value);

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    alg: state.alg,
    headerTyp: state.headerTyp,
    secret: state.secret,
    secretVisible: false,
    claims: state.claims.map((claim) => ({
      id: claim.id,
      name: claim.name,
      type: claim.type,
      value: claim.value,
    })),
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function algOr(value: unknown): HsAlg {
  return VALID_ALGS.includes(value as HsAlg) ? (value as HsAlg) : DEFAULT_STATE.alg;
}

function claimTypeOr(value: unknown): ClaimType {
  return VALID_CLAIM_TYPES.includes(value as ClaimType)
    ? (value as ClaimType)
    : (DEFAULT_STATE.claims[0]?.type ?? 'string');
}

function validClaims(value: unknown): ClaimEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && !Array.isArray(entry)
    )
    .map((entry) => ({
      id: stringOr(entry.id, nextClaimId()),
      name: stringOr(entry.name, ''),
      type: claimTypeOr(entry.type),
      value: stringOr(entry.value, ''),
    }))
    .slice(0, 64);
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected jwt-builder state object',
    };
  }
  const v = data as Record<string, unknown>;
  const state: ToolState = {
    alg: algOr(v.alg),
    headerTyp: stringOr(v.headerTyp, DEFAULT_STATE.headerTyp),
    secret: stringOr(v.secret, DEFAULT_STATE.secret),
    // Secret visibility is intentionally never persisted as visible.
    secretVisible: false,
    claims: validClaims(v.claims),
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const jwtBuilderTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [{ format: 'json', loader: () => import('./exporters/json') }],
};

export {
  ALGORITHMS,
  CLAIM_TYPES,
  DEFAULT_STATE,
  MAX_HISTORY,
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
};
export type { ClaimEntry, ClaimType, HsAlg, HistoryEntry, ToolState };
