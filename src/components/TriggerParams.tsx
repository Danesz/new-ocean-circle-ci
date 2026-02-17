import { useState } from 'react';
import type { Pipeline } from '../types/circleci';

/** Internal/system keys to filter out from trigger parameters */
const INTERNAL_PREFIXES = ['gitlab', 'git', 'circleci', 'pipeline'];

interface Props {
  pipeline: Pipeline;
}

/**
 * Displays pipeline trigger parameters as key-value pills.
 * Filters out internal CircleCI parameters and only shows user-defined ones.
 * Shows a "show all" toggle if internal params exist.
 */
export function TriggerParams({ pipeline }: Props) {
  const [showAll, setShowAll] = useState(false);
  const params = pipeline.trigger_parameters;

  if (!params || Object.keys(params).length === 0) return null;

  const entries = Object.entries(params);

  // Split into user params and internal params
  const userParams: Array<[string, unknown]> = [];
  const internalParams: Array<[string, unknown]> = [];

  for (const [key, value] of entries) {
    // Skip nested objects that are clearly internal (like "git", "gitlab")
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      internalParams.push([key, value]);
    } else if (INTERNAL_PREFIXES.some((p) => key.startsWith(p))) {
      internalParams.push([key, value]);
    } else {
      userParams.push([key, value]);
    }
  }

  const displayParams = showAll ? entries : userParams;

  if (displayParams.length === 0 && !showAll) {
    // Only internal params, show a minimal toggle
    if (internalParams.length > 0) {
      return (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          {internalParams.length} trigger param{internalParams.length !== 1 ? 's' : ''}
        </button>
      );
    }
    return null;
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {displayParams.map(([key, value]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs"
            title={`${key}: ${formatParamValue(value)}`}
          >
            <span className="text-slate-500">{key}:</span>
            <span className="text-slate-300 max-w-[150px] truncate">
              {formatParamValue(value)}
            </span>
          </span>
        ))}
      </div>

      {!showAll && internalParams.length > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-1 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          + {internalParams.length} more param{internalParams.length !== 1 ? 's' : ''}
        </button>
      )}

      {showAll && internalParams.length > 0 && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-1 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          hide internal params
        </button>
      )}
    </div>
  );
}

function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 60 ? json.slice(0, 57) + '...' : json;
    } catch {
      return '[object]';
    }
  }
  return String(value);
}
