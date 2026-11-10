import { redirect } from 'next/navigation';
import { currentAdminUser } from '@/lib/admin/users';
import UsersAdminView from './UsersAdminView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users & signups | Admin', robots: { index: false, follow: false } };

export default async function UsersAdminPage() {
  const user = await currentAdminUser();
  if (!user) redirect('/login?next=/admin/users');
  if (user.role !== 'admin') redirect('/');
  return <UsersAdminView />;
}
