import { resolveAuthConfig } from '@/auth/auth-config';
import { OperatorDashboard } from '@/components/operator-dashboard';

export default function HomePage() {
  return <OperatorDashboard authEnabled={resolveAuthConfig().enabled} />;
}
