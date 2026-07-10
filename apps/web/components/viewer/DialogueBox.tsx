'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface DictionaryEntry {
  word: string;
  description: string;
}

interface DialogueBoxProps {
  speakerName: string | null;
  fullText: string;
  isTyping: boolean;
  autoMode: boolean;
  autoSpeed: number; // 1.0, 1.5, 2.0
  onTypingComplete: () => void;
  onClick: () => void;
  dictionary: DictionaryEntry[];
}

const TYPING_SPEED_MS = 40; // 글자당 ms

export default function DialogueBox({
  speakerName,
  fullText,
  isTyping,
  autoMode,
  autoSpeed,
  onTypingComplete,
  onClick,
  dictionary,
}: DialogueBoxProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);

  // 타이핑 효과
  useEffect(() => {
    if (!fullText) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    // 새 텍스트 시작
    setDisplayedText('');
    setIsComplete(false);
    indexRef.current = 0;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      indexRef.current += 1;
      setDisplayedText(fullText.slice(0, indexRef.current));

      if (indexRef.current >= fullText.length) {
        clearInterval(intervalRef.current!);
        setIsComplete(true);
        onTypingComplete();
      }
    }, TYPING_SPEED_MS / autoSpeed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fullText, autoSpeed]);

  // 클릭 — 타이핑 즉시 완성
  const handleClick = useCallback(() => {
    if (!isComplete) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayedText(fullText);
      setIsComplete(true);
      onTypingComplete();
    } else {
      onClick();
    }
  }, [isComplete, fullText, onTypingComplete, onClick]);

  // 사전 단어 하이라이트 파싱
  const renderWithTooltips = (text: string) => {
    if (!dictionary.length) return text;

    // 등록된 단어들을 길이 내림차순으로 정렬 (긴 단어 우선 매칭)
    const sorted = [...dictionary].sort((a, b) => b.word.length - a.word.length);
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      let matched = false;
      for (const entry of sorted) {
        const idx = remaining.indexOf(entry.word);
        if (idx === 0) {
          parts.push(
            <GlossaryWord key={keyIdx++} word={entry.word} description={entry.description} />
          );
          remaining = remaining.slice(entry.word.length);
          matched = true;
          break;
        } else if (idx > 0) {
          parts.push(remaining.slice(0, idx));
          remaining = remaining.slice(idx);
          matched = true;
          break;
        }
      }
      if (!matched) {
        parts.push(remaining);
        remaining = '';
      }
    }
    return parts;
  };

  return (
    <div className="vn-dialogue-box" onClick={handleClick} role="button" tabIndex={0}>
      <div className="vn-dialogue-inner">
        {/* 마스크 페이드아웃 전용 배경 레이어 (텍스트보다 뒤쪽) */}
        <div className="vn-dialogue-bg" aria-hidden="true" />

        {/* 화자 이름 */}
        <div className="vn-speaker-name">
          {speakerName ?? ''}
        </div>

        {/* 대사 텍스트 */}
        <div className="vn-dialogue-text">
          {renderWithTooltips(displayedText)}
          {!isComplete && <span className="vn-typing-cursor" aria-hidden="true" />}
          {isComplete && !autoMode && (
            <span className="vn-next-indicator" aria-hidden="true">▶</span>
          )}
        </div>
      </div>
    </div>
  );
}

// 사전 단어 툴팁 컴포넌트
function GlossaryWord({ word, description }: { word: string; description: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="glossary-word"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {word}
      {visible && (
        <span className="glossary-tooltip" role="tooltip">
          <strong>{word}</strong><br />
          {description}
        </span>
      )}
    </span>
  );
}
