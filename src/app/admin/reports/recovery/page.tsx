import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/auth';
import RecoveryAdminView from './RecoveryAdminView';

export const dynamic = 'force-dynamic';

export default async function PaidRecoveryPage() {
  const token = (await cookies()).get('auth_token')?.value;
  const decoded = token ? verifyToken(token) : null;
  const user = decoded ? await getUserById(decoded.userId) : null;
  if (!user) redirect('/login?next=/admin/reports/recovery');
  if (user.role !== 'editor' && user.role !== 'admin') redirect('/');
  return <RecoveryAdminView />;
}
