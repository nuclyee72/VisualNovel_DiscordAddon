'use client';
import type { CharacterState } from './CharacterLayer';

export interface PlayerStats {
  discordId: string;
  name: string;
  avatarUrl: string;
  role: 'master' | 'player';
  hp: { current: number; max: number };
  mp: { current: number; max: number };
}

interface StatusPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  players: PlayerStats[];
  speakingDiscordId: string | null;
  sessionName: string;
  onDownloadLog: (format: 'txt' | 'json') => void;
}

export default function StatusPanel({
  isOpen,
  onToggle,
  players,
  speakingDiscordId,
  sessionName,
  onDownloadLog,
}: StatusPanelProps) {
  return (
    <>
      {/* 사이드바 토글 버튼 — 열려 있을 때는 패널 안의 닫기 버튼으로 대체되므로
          숨긴다 (안 숨기면 패널에 가려져 다시 누를 수 없게 된다). BGMPlayer의
          재생 중 배지(top:16px/right:16px)와도 자리가 겹치지 않게 그 아래로 배치. */}
      {!isOpen && (
        <button
          className="vn-ctrl-btn"
          onClick={onToggle}
          style={{ position: 'absolute', top: '64px', right: '16px', zIndex: 'var(--z-sidebar)' as never }}
          aria-label="상태창 열기"
          title="캐릭터 상태창"
        >
          <span className="material-icons" style={{ fontSize: '1.15rem' }}>groups</span>
        </button>
      )}

      {/* 사이드 패널 */}
      <aside className={`vn-sidebar ${isOpen ? 'open' : ''}`} aria-label="상태창">
        <div className="vn-sidebar-inner scrollbar-custom">
          {/* 세션명 + 닫기 버튼 — 항상 상단 우측 고정인 "나가기" 버튼과 겹치지
              않도록 vn-sidebar-inner 상단 padding으로 여유를 확보해뒀다. */}
          <div className="vn-sidebar-header">
            <div className="vn-sidebar-title" title={sessionName}>{sessionName}</div>
            <button className="vn-sidebar-close-btn" onClick={onToggle} aria-label="상태창 닫기" title="닫기">
              <span className="material-icons" style={{ fontSize: '1.1rem' }}>close</span>
            </button>
          </div>

          {/* 플레이어 상태 목록 */}
          <section>
            <div className="vn-sidebar-section-label">참가자</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {players.map((player) => (
                <PlayerCard
                  key={player.discordId}
                  player={player}
                  isSpeaking={player.discordId === speakingDiscordId}
                />
              ))}
              {players.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  참여자를 기다리는 중...
                </div>
              )}
            </div>
          </section>

          {/* 로그 다운로드 */}
          <section style={{ marginTop: 'auto' }}>
            <div className="vn-sidebar-section-label">대화 로그</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary vn-log-download-btn"
                onClick={() => onDownloadLog('txt')}
              >
                <span className="material-icons" style={{ fontSize: '1rem' }}>description</span>
                TXT
              </button>
              <button
                className="btn btn-secondary vn-log-download-btn"
                onClick={() => onDownloadLog('json')}
              >
                <span className="material-icons" style={{ fontSize: '1rem' }}>data_object</span>
                JSON
              </button>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function PlayerCard({ player, isSpeaking }: { player: PlayerStats; isSpeaking: boolean }) {
  const hasHp = player.hp.max > 0;
  const hasMp = player.mp.max > 0;
  const hpPercent = hasHp ? (player.hp.current / player.hp.max) * 100 : 0;
  const mpPercent = hasMp ? (player.mp.current / player.mp.max) * 100 : 0;

  return (
    <div className={`vn-player-card ${isSpeaking ? 'speaking-card' : ''}`}>
      <div className="vn-player-card-header">
        <img
          src={player.avatarUrl || '/assets/default-avatar.png'}
          alt={player.name}
          className="vn-player-avatar"
        />
        <span className="vn-player-name">{player.name}</span>
        {player.role === 'master' && (
          <span className="vn-player-role">DM</span>
        )}
        {isSpeaking && <span className="vn-speaking-dot" title="발언 중" aria-label="발언 중" />}
      </div>

      {/* 스탯이 설정되지 않은 캐릭터는 "0 / 0" + 빈 막대 대신 안내 문구만 보여준다 */}
      {!hasHp && !hasMp ? (
        <div className="vn-player-no-stats">등록된 캐릭터 스탯 없음</div>
      ) : (
        <>
          {hasHp && (
            <div className="stat-bar-container">
              <div className="stat-bar-label">
                <span>HP</span>
                <span style={{ color: hpPercent < 30 ? 'var(--color-hp)' : 'var(--color-text-secondary)' }}>
                  {player.hp.current} / {player.hp.max}
                </span>
              </div>
              <div className="stat-bar-track">
                <div
                  className="stat-bar-fill hp"
                  style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
                />
              </div>
            </div>
          )}

          {hasMp && (
            <div className="stat-bar-container">
              <div className="stat-bar-label">
                <span>MP</span>
                <span>{player.mp.current} / {player.mp.max}</span>
              </div>
              <div className="stat-bar-track">
                <div
                  className="stat-bar-fill mp"
                  style={{ width: `${Math.max(0, Math.min(100, mpPercent))}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
