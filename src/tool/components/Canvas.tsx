'use client';

import React from 'react';
import { CLAIM_TYPES, validationSummary, type ClaimEntry, type ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
  /** Latest signed token or error text from the client. */
  token?: string | null;
  /** Validation/signing error surfaced by the client. */
  error?: string | null;
  /** True while signing is in flight. */
  signing?: boolean;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
const monoInputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy value"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({
  state,
  onChange,
  onSaveHistory,
  token,
  error,
  signing,
}) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const validation = validationSummary(state);

  const updateClaim = (id: string, patch: Partial<ClaimEntry>) => {
    update({ claims: state.claims.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const removeClaim = (id: string) => {
    update({ claims: state.claims.filter((c) => c.id !== id) });
  };

  const addClaim = () => {
    update({
      claims: [
        ...state.claims,
        {
          id: `claim-manual-${state.claims.length}-${Date.now().toString(36)}`,
          name: '',
          type: 'string',
          value: '',
        },
      ],
    });
  };

  const segments = token ? token.split('.') : [];

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="jwt-canvas">
      <div className="grid gap-4 sm:grid-cols-2" data-testid="header-inputs">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Algorithm
          <select
            value={state.alg}
            onChange={(e) => {
              const next = e.target.value;
              if (next === 'HS256' || next === 'HS384' || next === 'HS512') {
                update({ alg: next });
              }
            }}
            data-testid="canvas-select-alg"
            className={inputClass}
          >
            <option value="HS256">HS256</option>
            <option value="HS384">HS384</option>
            <option value="HS512">HS512</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Header typ
          <input
            type="text"
            value={state.headerTyp}
            onChange={(e) => update({ headerTyp: e.target.value })}
            data-testid="input-typ"
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Shared secret (HMAC key)
          <div className="flex gap-2">
            <input
              type={state.secretVisible ? 'text' : 'password'}
              value={state.secret}
              onChange={(e) => update({ secret: e.target.value })}
              data-testid="input-secret"
              data-sensitive="true"
              className={monoInputClass}
            />
            <button
              type="button"
              onClick={() => update({ secretVisible: !state.secretVisible })}
              data-testid="btn-toggle-secret"
              className="mt-1 rounded-md border border-gray-300 px-2 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {state.secretVisible ? 'Hide' : 'Show'}
            </button>
          </div>
          {state.secret.length === 0 ? (
            <span
              className="mt-1 block text-xs text-red-600 dark:text-red-400"
              data-testid="secret-error"
            >
              Signing secret is required
            </span>
          ) : null}
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Payload claims
          </h3>
          <button
            type="button"
            onClick={addClaim}
            data-testid="btn-add-claim"
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            + Add claim
          </button>
        </div>
        {state.claims.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="claims-empty">
            No claims yet — add one manually or pick a registered claim from the sidebar.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="claims-list">
            {state.claims.map((claim) => (
              <li
                key={claim.id}
                className="grid gap-2 rounded-md border border-gray-200 p-2 sm:grid-cols-[1fr_auto_2fr_auto] dark:border-gray-800"
                data-testid="claim-row"
              >
                <input
                  type="text"
                  placeholder="claim name"
                  value={claim.name}
                  onChange={(e) => updateClaim(claim.id, { name: e.target.value })}
                  data-testid="claim-name"
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <select
                  aria-label="Claim value type"
                  value={claim.type}
                  onChange={(e) =>
                    updateClaim(claim.id, { type: e.target.value as ClaimEntry['type'] })
                  }
                  data-testid="claim-type"
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {CLAIM_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="value (JSON accepted for json type)"
                  value={claim.value}
                  onChange={(e) => updateClaim(claim.id, { value: e.target.value })}
                  data-testid="claim-value"
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => removeClaim(claim.id)}
                  data-testid="claim-remove"
                  aria-label={`Remove claim ${claim.name || 'unnamed'}`}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {onSaveHistory ? (
          <button
            type="button"
            data-testid="btn-sign-token"
            disabled={!validation.valid || signing}
            onClick={() => onSaveHistory('sign')}
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signing ? 'Signing…' : 'Sign token'}
          </button>
        ) : null}
      </div>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        data-testid="token-card"
        role="status"
      >
        <span className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Token
        </span>
        {error ? (
          <span
            className="block rounded-md bg-red-50 px-3 py-2 font-mono text-xs text-red-700 dark:bg-red-900/40 dark:text-red-200"
            data-testid="token-error"
            role="alert"
          >
            {error}
          </span>
        ) : token ? (
          <>
            <span className="block break-all font-mono text-sm" data-testid="token-preview">
              <span data-testid="segment-header" className="text-indigo-600 dark:text-indigo-300">
                {segments[0]}
              </span>
              <span className="text-gray-500">.</span>
              <span
                data-testid="segment-payload"
                className="text-emerald-600 dark:text-emerald-300"
              >
                {segments[1]}
              </span>
              <span className="text-gray-500">.</span>
              <span data-testid="segment-signature" className="text-amber-600 dark:text-amber-300">
                {segments[2]}
              </span>
            </span>
            <div className="mt-2 flex items-center gap-2">
              <CopyButton value={token} testid="copy-token" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {state.alg} · signed locally
              </span>
            </div>
          </>
        ) : (
          <span
            className="block font-mono text-sm text-gray-400 dark:text-gray-500"
            data-testid="token-placeholder"
          >
            {validation.valid
              ? 'Press “Sign token” to build the JWT.'
              : 'Fix validation errors to sign.'}
          </span>
        )}
      </div>

      {token ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Decoded payload
          </h3>
          <pre
            className="overflow-x-auto font-mono text-xs text-gray-700 dark:text-gray-300"
            data-testid="decoded-payload"
          >
            {JSON.stringify(safeParse(token), null, 2)}
          </pre>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          History
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No saved tokens yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="break-all text-gray-700 dark:text-gray-300">{entry.text}</span>
                <CopyButton value={entry.text} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        Tokens are built and signed entirely in your browser; nothing is uploaded.
      </p>
    </div>
  );
};

/** Payload object of the given token, or null when it cannot be parsed. */
function safeParse(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default Canvas;
