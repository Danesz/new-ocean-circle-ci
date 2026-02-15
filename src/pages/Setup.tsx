import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Setup() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !projectSlug.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Normalize project slug
      let slug = projectSlug.trim();
      // If user enters "org/repo", default to "gh/org/repo"
      if (slug.split('/').length === 2) {
        slug = `gh/${slug}`;
      }

      await login(token.trim(), slug);
      navigate('/branches');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo & title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 32 32" fill="none" className="w-16 h-16 text-ocean-400">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="14" r="3" fill="currentColor" />
              <circle cx="22" cy="14" r="3" fill="currentColor" />
              <path d="M10 14 L22 14" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" />
              <circle cx="16" cy="22" r="3" fill="currentColor" opacity="0.7" />
              <path d="M10 14 L16 22" stroke="currentColor" strokeWidth="1.5" />
              <path d="M22 14 L16 22" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Ocean CI</h1>
          <p className="text-slate-400 mt-2">
            A Blue Ocean-style pipeline visualizer for CircleCI
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="token"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              CircleCI API Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your personal API token"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 transition-colors"
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Create one at{' '}
              <a
                href="https://app.circleci.com/settings/user/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ocean-400 hover:text-ocean-300"
              >
                CircleCI &rarr; User Settings &rarr; Personal API Tokens
              </a>
            </p>
          </div>

          <div>
            <label
              htmlFor="project"
              className="block text-sm font-medium text-slate-300 mb-1.5"
            >
              Project Slug
            </label>
            <input
              id="project"
              type="text"
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value)}
              placeholder="gh/org/repo"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 transition-colors font-mono text-sm"
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Format: <code className="text-slate-400">gh/your-org/your-repo</code>
              {' '}or just <code className="text-slate-400">your-org/your-repo</code>
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/50 border border-red-900/50 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim() || !projectSlug.trim()}
            className="w-full py-2.5 bg-ocean-600 hover:bg-ocean-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    className="opacity-75"
                  />
                </svg>
                Connecting...
              </>
            ) : (
              'Connect to CircleCI'
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
          <h3 className="text-sm font-medium text-slate-300 mb-2">
            How it works
          </h3>
          <ul className="text-xs text-slate-500 space-y-1.5">
            <li>
              Your API token is stored locally in your browser and sent directly
              to the CircleCI API through a development proxy.
            </li>
            <li>
              No data is sent to any third-party server.
            </li>
            <li>
              You can view branches, pipelines, workflows, and job details with
              a Blue Ocean-style visualization.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
