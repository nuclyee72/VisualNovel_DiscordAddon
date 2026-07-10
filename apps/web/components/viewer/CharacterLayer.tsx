'use client';

export interface CharacterState {
  discordId: string;
  name: string;
  avatarUrl: string;
  standingImageUrl: string | null; // 구버전 호환용 (단일 이미지)
  baseImageUrl?: string | null;    // (NEW) 기본 몸통 이미지
  faceImageUrl?: string | null;    // (NEW) 표정 파츠 이미지
  anchorX?: number;                // (NEW) 얼굴 X축 중심 위치 (0~100%)
  anchorY?: number;                // (NEW) 얼굴 Y축 중심 위치 (0~100%)
  isSpeaking: boolean;
  position: number; // 0~4
}

interface CharacterLayerProps {
  characters: CharacterState[];
}

export default function CharacterLayer({ characters }: CharacterLayerProps) {
  return (
    <div className="vn-characters">
      {characters.map((char) => (
        <div
          key={char.discordId}
          className={`vn-character ${char.isSpeaking ? 'speaking' : 'idle'}`}
          data-pos={char.position}
          aria-label={char.name}
        >
          {char.baseImageUrl ? (
            /* 파츠 합성 방식 (Base + Face) */
            <div className="vn-character-composite">
              <img
                src={char.baseImageUrl}
                alt={`${char.name} 베이스`}
                className="vn-character-base"
                draggable={false}
              />
              {char.faceImageUrl && (
                <img
                  src={char.faceImageUrl}
                  alt={`${char.name} 표정`}
                  className="vn-character-face"
                  draggable={false}
                  style={{
                    left: `${char.anchorX ?? 50}%`,
                    top: `${char.anchorY ?? 10}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              )}
            </div>
          ) : char.standingImageUrl ? (
            /* 기존 단일 스탠딩 이미지 */
            <img
              src={char.standingImageUrl}
              alt={`${char.name} 스탠딩`}
              className="vn-character-img"
              draggable={false}
            />
          ) : (
            /* 폴백: Discord 아바타 원형 */
            <img
              src={char.avatarUrl || '/assets/default-avatar.png'}
              alt={char.name}
              className="vn-character-avatar-fallback"
              draggable={false}
            />
          )}
          <span className="vn-character-name-tag">{char.name}</span>
        </div>
      ))}
    </div>
  );
}
