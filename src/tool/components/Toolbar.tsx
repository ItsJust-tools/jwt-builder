'use client';

import React from 'react';
import { ALGORITHMS, type ToolState } from '../types';

interface ToolbarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
  onClear: () => void;
  onCopy?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, onChange, onClear, onCopy }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2" role="group" aria-label="JWT Builder controls">
        <select
          aria-label="Signing algorithm"
          data-testid="select-alg"
          value={state.alg}
          onChange={(e) => {
            const next = e.target.value;
            if (ALGORITHMS.some((a) => a.value === next)) {
              onChange({ ...state, alg: next as ToolState['alg'] });
            }
          }}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          {ALGORITHMS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.value}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onClear}
          data-testid="btn-clear"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            data-testid="btn-copy-result"
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
          >
            Copy token
          </button>
        ) : null}
        {state.history.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ ...state, history: [] })}
            data-testid="btn-clear-history"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Clear history
          </button>
        ) : null}
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400" data-testid="toolbar-alg-label">
        {state.alg}
      </span>
    </div>
  );
};

export default Toolbar;
