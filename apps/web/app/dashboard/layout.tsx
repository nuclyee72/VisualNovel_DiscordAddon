import { Topbar } from '@/components/layout/Topbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-layout">
      <Topbar />
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
