import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/auth';
import RecoveryAdminView from './RecoveryAdminView';
import { isProductionHost } from '@/lib/seo/host';

export const dynamic = 'force-dynamic';

export default async function PaidRecoveryPage() {
  if (isProductionHost((await headers()).get('host'))) redirect('/');
  const token = (await cookies()).get('auth_token')?.value;
  const decoded = token ? verifyToken(token) : null;
  const user = decoded ? await getUserById(decoded.userId) : null;
  if (!user) redirect('/login?next=/admin/reports/recovery');
  if (user.role !== 'editor' && user.role !== 'admin') redirect('/');
  return <RecoveryAdminView />;
}
