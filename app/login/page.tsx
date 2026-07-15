import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-panel">
        <header className="login-header">
          <h1>Fabel</h1>
          <p>Sign in to run workflows and review gated artifacts.</p>
        </header>
        <Suspense fallback={<p className="empty-state">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
