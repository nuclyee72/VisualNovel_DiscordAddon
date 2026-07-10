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

  const diceNumber = payload.total % 6 + 1; // 면에 표시할 숫자

  return (
    <div className="vn-dice-overlay" onClick={onClose} role="dialog" aria-label="주사위 결과">
      <div className="vn-dice-container" onClick={(e) => e.stopPropagation()}>
        {/* 3D 주사위 */}
        <div className="vn-dice-3d">
          <div className="vn-dice-cube">
            {[1, 2, 3, 4, 5, 6].map((face) => (
              <div key={face} className="vn-dice-face">
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
