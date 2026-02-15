import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Setup } from './pages/Setup';
import { Branches } from './pages/Branches';
import { Pipelines } from './pages/Pipelines';
import { Triggers } from './pages/Triggers';
import { WorkflowDetail } from './pages/WorkflowDetail';

function AppRoutes() {
  const { token, projectSlug } = useAuth();
  const isAuthenticated = !!token && !!projectSlug;

  return (
    <Routes>
      {/* Setup page - always accessible */}
      <Route
        path="/setup"
        element={
          isAuthenticated ? <Navigate to="/branches" replace /> : <Setup />
        }
      />

      {/* Protected routes */}
      <Route
        path="/branches"
        element={
          isAuthenticated ? (
            <Layout>
              <Branches />
            </Layout>
          ) : (
            <Navigate to="/setup" replace />
          )
        }
      />
      <Route
        path="/branches/:branch"
        element={
          isAuthenticated ? (
            <Layout>
              <Pipelines />
            </Layout>
          ) : (
            <Navigate to="/setup" replace />
          )
        }
      />
      <Route
        path="/triggers"
        element={
          isAuthenticated ? (
            <Layout>
              <Triggers />
            </Layout>
          ) : (
            <Navigate to="/setup" replace />
          )
        }
      />
      <Route
        path="/pipeline/:pipelineId/workflow/:workflowId"
        element={
          isAuthenticated ? (
            <Layout>
              <WorkflowDetail />
            </Layout>
          ) : (
            <Navigate to="/setup" replace />
          )
        }
      />

      {/* Default redirect */}
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? '/branches' : '/setup'} replace />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
