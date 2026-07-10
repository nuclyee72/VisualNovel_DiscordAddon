import Link from 'next/link';

export default function DashboardPage() {
  const sessions = [
    { id: '1', name: '예시 방 1', description: '예시 방 1에 대한 간단한 설명 텍스트가 표시되는 공간입니다.' },
    { id: '2', name: '예시 방 2', description: '예시 방 2에 대한 간단한 설명 텍스트가 표시되는 공간입니다.' }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">비주얼 노벨 뷰어 창 목록</h1>
          <p className="page-subtitle">현재 참여 가능한 비주얼 노벨 대화창 예시 목록입니다.</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'none' }}>
          <span className="material-icons">add</span> 새 방 만들기
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {sessions.map(s => (
          <div key={s.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>{s.name}</h3>
            </div>
            
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {s.description}
            </div>

            <Link href={`/session/${s.id}`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              참가하기 ▶
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
