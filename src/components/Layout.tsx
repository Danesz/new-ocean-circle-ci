import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, projectSlug, logout } = useAuth();
  const location = useLocation();

  // Build breadcrumb from current path
  const crumbs = buildBreadcrumbs(location.pathname, projectSlug);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-ocean-400 hover:text-ocean-300 transition-colors"
          >
            <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="10" cy="14" r="3" fill="currentColor" />
              <circle cx="22" cy="14" r="3" fill="currentColor" />
              <path d="M10 14 L22 14" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" />
              <circle cx="16" cy="22" r="3" fill="currentColor" opacity="0.7" />
              <path d="M10 14 L16 22" stroke="currentColor" strokeWidth="1.5" />
              <path d="M22 14 L16 22" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="font-semibold text-lg">Ocean CI</span>
          </Link>

          {/* Breadcrumbs */}
          {crumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-sm text-slate-400 ml-2">
              {crumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1">
                  <span className="text-slate-600">/</span>
                  {i < crumbs.length - 1 ? (
                    <Link
                      to={crumb.path}
                      className="hover:text-slate-200 transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-200">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-slate-400">
              {user.name || user.login}
            </span>
          )}
          {projectSlug && (
            <button
              onClick={logout}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Switch project
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 page-enter">{children}</main>
    </div>
  );
}

interface Crumb {
  label: string;
  path: string;
}

function buildBreadcrumbs(pathname: string, projectSlug: string | null): Crumb[] {
  const crumbs: Crumb[] = [];
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'branches' && projectSlug) {
    crumbs.push({ label: projectSlug.split('/').slice(-1)[0], path: '/branches' });

    if (segments[1]) {
      const branch = decodeURIComponent(segments[1]);
      crumbs.push({
        label: branch,
        path: `/branches/${encodeURIComponent(branch)}`,
      });
    }
  }

  if (segments[0] === 'triggers' && projectSlug) {
    crumbs.push({ label: projectSlug.split('/').slice(-1)[0], path: '/branches' });
    crumbs.push({ label: 'Triggers', path: '/triggers' });
  }

  if (segments[0] === 'pipeline' && segments[1]) {
    if (projectSlug) {
      crumbs.push({ label: projectSlug.split('/').slice(-1)[0], path: '/branches' });
    }
    crumbs.push({
      label: `Pipeline #${segments[1]}`,
      path: `/pipeline/${segments[1]}`,
    });

    if (segments[2] === 'workflow' && segments[3]) {
      crumbs.push({
        label: 'Workflow',
        path: `/pipeline/${segments[1]}/workflow/${segments[3]}`,
      });
    }
  }

  return crumbs;
}

/** Loading skeleton placeholder */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** Full-page error display */
export function ErrorDisplay({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="text-red-400 text-lg">Something went wrong</div>
      <div className="text-slate-400 text-sm max-w-md text-center">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** Empty state placeholder */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500">
      {message}
    </div>
  );
}
