'use client';

import React from 'react';
import {
  ALGORITHMS,
  CLAIM_TYPES,
  EPOCH_CLAIMS,
  REGISTERED_CLAIMS,
  relativeToEpoch,
  utcNowSeconds,
  type ToolState,
} from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  const addRegisteredClaim = (name: string, suggestNumber: boolean) => {
    onChange({
      ...state,
      claims: [
        ...state.claims,
        {
          id: `claim-${name}-${utcNowSeconds()}-${state.claims.length}`,
          name,
          type: suggestNumber ? 'number' : 'string',
          value: suggestNumber ? String(utcNowSeconds()) : '',
        },
      ],
    });
  };

  const applyRelative = (claimId: string, minutes: number) => {
    onChange({
      ...state,
      claims: state.claims.map((claim) =>
        claim.id === claimId ? { ...claim, value: String(relativeToEpoch(minutes)) } : claim
      ),
    });
  };

  const namedClaims = state.claims.filter((claim) => claim.name.trim() !== '');

  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="jwt-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Algorithms</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {ALGORITHMS.map((a) => (
            <li key={a.value} className="flex justify-between gap-2">
              <span>{a.value}</span>
              <span className="text-gray-500 dark:text-gray-400">HMAC · SHA-{a.bits}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          Registered claims (RFC 7519)
        </h3>
        <div className="flex flex-wrap gap-1" data-testid="registered-claims">
          {REGISTERED_CLAIMS.map((rc) => (
            <button
              key={rc.name}
              type="button"
              title={rc.hint}
              onClick={() => addRegisteredClaim(rc.name, rc.suggestNumber)}
              data-testid={`add-claim-${rc.name}`}
              className="rounded border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              +{rc.name}
            </button>
          ))}
        </div>
      </div>

      {namedClaims.filter((c) => EPOCH_CLAIMS.includes(c.name)).length > 0 ? (
        <div>
          <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
            Relative time helpers
          </h3>
          <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
            {namedClaims
              .filter((c) => EPOCH_CLAIMS.includes(c.name))
              .map((claim) => (
                <li
                  key={claim.id}
                  className="flex items-center gap-1"
                  data-testid={`relative-${claim.name}`}
                >
                  <span className="font-mono">{claim.name}</span>
                  {[15, 60, 1440].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => applyRelative(claim.id, minutes)}
                      data-testid={`relative-${claim.name}-${minutes}`}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      {minutes === 15 ? '+15m' : minutes === 60 ? '+1h' : '+24h'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => applyRelative(claim.id, -15)}
                    data-testid={`relative-${claim.name}-minus15`}
                    className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    −15m
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved tokens</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} token{state.history.length === 1 ? '' : 's'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Claim types</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {CLAIM_TYPES.map((ct) => (
            <li key={ct.value} className="flex justify-between gap-2">
              <span className="font-mono">{ct.value}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {ct.value === 'string'
                  ? 'text as-is'
                  : ct.value === 'number'
                    ? 'parsed number'
                    : ct.value === 'boolean'
                      ? 'true / false'
                      : 'raw JSON'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current header, claims and
          secret so the same token can be rebuilt after opening it.
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
