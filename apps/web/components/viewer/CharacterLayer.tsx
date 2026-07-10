'use client';

export interface CharacterImage {
  tag: string;  // e.g. '#Neutral'
  url: string;
}

export interface CharacterState {
  discordId: string;
  name: string;
  avatarUrl: string;
  standingImageUrl: string | null;
  baseImageUrl?: string | null;
  faceImageUrl?: string | null;
  anchorX?: number;
  anchorY?: number;
  currentTag?: string;    // (NEW) 현재 표정 태그 e.g. '#Happy'
  images?: CharacterImage[];  // (NEW) 등록된 표정 이미지 목록
  isSpeaking: boolean;
  position: number;
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
              {(() => {
                // currentTag로 images에서 URL 찾기, 없으면 faceImageUrl 폴백
                const tag = char.currentTag || '#Neutral';
                const resolved = char.images?.find(img => img.tag === tag)?.url
                  || char.images?.find(img => img.tag === '#Neutral')?.url
                  || char.faceImageUrl;
                return resolved ? (
                  <img
                    src={resolved}
                    alt={`${char.name} 표정`}
                    className="vn-character-face"
                    draggable={false}
                    style={{
                      left: `${char.anchorX ?? 50}%`,
                      top: `${char.anchorY ?? 10}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                ) : null;
              })()}
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
