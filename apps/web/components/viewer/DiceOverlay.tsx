'use client';
import { useEffect, useState } from 'react';
import type { DicePayload } from '../../../../packages/shared/src/index';

interface DiceOverlayProps {
  payload: DicePayload | null;
  onClose: () => void;
}

export default function DiceOverlay({ payload, onClose }: DiceOverlayProps) {
  const [phase, setPhase] = useState<'spinning' | 'result' | 'hidden'>('hidden');

  useEffect(() => {
    if (!payload) {
      setPhase('hidden');
      return;
    }

    // 1. 주사위 굴리는 애니메이션 (1.4초)
    setPhase('spinning');

    const resultTimer = setTimeout(() => {
      setPhase('result');
    }, 1400);

    // 3. 자동 닫힘 (결과 표시 후 3초)
    const closeTimer = setTimeout(() => {
      setPhase('hidden');
      onClose();
    }, 4500);

    return () => {
      clearTimeout(resultTimer);
      clearTimeout(closeTimer);
    };
  }, [payload]);

  if (phase === 'hidden' || !payload) return null;

  // 실제 굴림 결과(rolls[0], 없으면 total)를 1~6 범위로 접어 굴리는 동안/결과 표시
  // 애니메이션에서 어떤 주사위 눈을 보여줄지 결정한다. 이전에는 계산만 하고
  // 실제 표시에는 전혀 반영되지 않던 죽은 변수였다.
  const rolledValue = payload.rolls[0] ?? payload.total;
  const diceNumber = ((Math.abs(rolledValue) - 1) % 6) + 1; // 면에 표시할 숫자 (1~6)

  return (
    <div className="vn-dice-overlay" onClick={onClose} role="dialog" aria-label="주사위 결과">
      <div className="vn-dice-container" onClick={(e) => e.stopPropagation()}>
        {/* 3D 주사위 */}
        <div className={`vn-dice-3d ${phase === 'result' ? `show-face-${diceNumber}` : 'rolling'}`}>
          <div className="vn-dice-cube">
            {[1, 2, 3, 4, 5, 6].map((face) => (
              <div
                key={face}
                className={`vn-dice-face ${phase === 'result' && face === diceNumber ? 'is-result-face' : ''}`}
              >
                {face}
              </div>
            ))}
          </div>
        </div>

        {/* 결과값 */}
        {phase === 'result' && (
          <div className="vn-dice-result">
            <div className="vn-dice-result-user">
              🎲 {payload.userName}
            </div>
            <div className="vn-dice-result-formula">
              {payload.formula}
            </div>
            <div className="vn-dice-result-total">
              {payload.total}
            </div>
            {payload.rolls.length > 1 && (
              <div className="vn-dice-result-detail">
                [{payload.rolls.join(' + ')}]
                {payload.modifier !== 0 && ` ${payload.modifier > 0 ? '+' : ''}${payload.modifier}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
