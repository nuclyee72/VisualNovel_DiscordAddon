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
  // 같은 화자가 이어서 말해 fullText 뒤에 텍스트가 추가된 경우(병합) 감지용 —
  // 이미 타이핑된 부분은 다시 처음부터 치지 않고 이어서 타이핑하기 위함.
  const prevFullTextRef = useRef('');

  // onTypingComplete를 항상 최신 상태로 유지하는 ref
  // (부모가 autoMode 등의 변경으로 새 콜백을 넘겨도, 타이핑 도중 갱신된 콜백을 놓치지 않도록)
  const onTypingCompleteRef = useRef(onTypingComplete);
  useEffect(() => {
    onTypingCompleteRef.current = onTypingComplete;
  }, [onTypingComplete]);

  // 타이핑 효과
  useEffect(() => {
    if (!fullText) {
      setDisplayedText('');
      setIsComplete(false);
      prevFullTextRef.current = '';
      return;
    }

    // 같은 화자가 이어서 말해 이전 텍스트 뒤에 내용이 추가된 경우(줄바꿈 병합)에는
    // 이미 표시된 부분을 그대로 두고 이어서 타이핑한다. 그 외(새 대사 시작, 화자
    // 교체 등)에는 처음부터 다시 타이핑한다.
    const isAppend =
      prevFullTextRef.current.length > 0 &&
      fullText !== prevFullTextRef.current &&
      fullText.startsWith(prevFullTextRef.current);
    prevFullTextRef.current = fullText;

    if (!isAppend) {
      setDisplayedText('');
      indexRef.current = 0;
    }
    setIsComplete(false);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      indexRef.current += 1;
      setDisplayedText(fullText.slice(0, indexRef.current));

      if (indexRef.current >= fullText.length) {
        clearInterval(intervalRef.current!);
        setIsComplete(true);
        onTypingCompleteRef.current();
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
      onTypingCompleteRef.current();
    } else {
      onClick();
    }
  }, [isComplete, fullText, onClick]);

  // 사전 단어 하이라이트 파싱
  const renderWithTooltips = (text: string) => {
    if (!dictionary.length) return text;

    // 빈 문자열/공백뿐인 단어는 제외 — indexOf('')는 항상 0을 반환해
    // remaining이 절대 줄어들지 않는 무한 루프를 유발한다.
    // 등록된 단어들을 길이 내림차순으로 정렬 (긴 단어 우선 매칭)
    const sorted = [...dictionary]
      .filter((entry) => entry.word && entry.word.trim().length > 0)
      .sort((a, b) => b.word.length - a.word.length);
    if (!sorted.length) return text;

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

        {/* 화자 이름 — 대사가 없을 때는 ":" 표시까지 통째로 숨긴다 */}
        {speakerName && <div className="vn-speaker-name">{speakerName}</div>}

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
