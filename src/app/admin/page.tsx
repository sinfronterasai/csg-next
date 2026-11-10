import { redirect } from 'next/navigation';
import { currentAdminUser } from '@/lib/admin/users';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function AdminPage() {
  const user = await currentAdminUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role === 'admin') redirect('/admin/users');
  if (user.role === 'editor') redirect('/admin/reports/recovery');
  redirect('/');
}
