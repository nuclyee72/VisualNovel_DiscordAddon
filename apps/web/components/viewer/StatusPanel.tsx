'use client';
import type { CharacterState } from './CharacterLayer';

interface PlayerStats {
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
      {/* 사이드바 토글 버튼 */}
      <button
        className="vn-ctrl-btn"
        onClick={onToggle}
        style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 'var(--z-sidebar)' as never }}
        aria-label="상태창 열기/닫기"
        title="캐릭터 상태창"
      >
        ⚔
      </button>

      {/* 사이드 패널 */}
      <aside className={`vn-sidebar ${isOpen ? 'open' : ''}`} aria-label="상태창">
        <div className="vn-sidebar-inner scrollbar-custom">
          {/* 세션명 */}
          <div className="vn-sidebar-title">⚔ {sessionName}</div>

          {/* 플레이어 상태 목록 */}
          <section>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', letterSpacing: '0.1em' }}>
              CHARACTERS
            </div>
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
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', letterSpacing: '0.1em' }}>
              SESSION LOG
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '8px' }}
                onClick={() => onDownloadLog('txt')}
              >
                📄 TXT
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '8px' }}
                onClick={() => onDownloadLog('json')}
              >
                📋 JSON
              </button>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function PlayerCard({ player, isSpeaking }: { player: PlayerStats; isSpeaking: boolean }) {
  const hpPercent = player.hp.max > 0 ? (player.hp.current / player.hp.max) * 100 : 0;
  const mpPercent = player.mp.max > 0 ? (player.mp.current / player.mp.max) * 100 : 0;

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
        {isSpeaking && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-accent-primary)', animation: 'micPulse 1.5s infinite' }}>
            🎙
          </span>
        )}
      </div>

      {/* HP 바 */}
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

      {/* MP 바 */}
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
    </div>
  );
}
