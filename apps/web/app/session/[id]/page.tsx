import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SessionViewer from '@/components/viewer/SessionViewer';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `세션 뷰어 | 비주얼 노벨`,
    description: '비주얼 노벨 세션 화면',
  };
}

export default async function SessionPage({ params }: Props) {
  const cookieStore = cookies();
  const token = cookieStore.get('vn_token');

  if (!token) {
    redirect('/login');
  }

  return <SessionViewer sessionId={params.id} />;
}
