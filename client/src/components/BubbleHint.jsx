import React, { useState, useLayoutEffect, useEffect, useMemo } from 'react';

const BUBBLE_COUNT = 6;
const DURATION_MS = 1100;
const BASE_SIZE = 18;

/** 简单伪随机，同一索引得到固定值，避免每次渲染变化 */
function seeded(seed) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * 从 startRect 位置飘向 endRef 所指元素的气泡引导
 * 路径带弧度，气泡大小随机
 * onReachTarget: 气泡到达目标时调用（用于触发目标按钮摇晃等）
 */
function BubbleHint({ startRect, endRef, onComplete, onReachTarget }) {
  const [endRect, setEndRect] = useState(null);

  useLayoutEffect(() => {
    if (!startRect || !endRef?.current) return;
    setEndRect(endRef.current.getBoundingClientRect());
  }, [startRect, endRef]);

  useEffect(() => {
    const reachT = setTimeout(() => onReachTarget?.(), DURATION_MS);
    const completeT = setTimeout(() => onComplete?.(), DURATION_MS + 200);
    return () => {
      clearTimeout(reachT);
      clearTimeout(completeT);
    };
  }, [onComplete, onReachTarget]);

  const bubbles = useMemo(() => {
    if (!startRect || !endRect) return [];
    const startCx = startRect.left + startRect.width / 2;
    const startCy = startRect.top + startRect.height / 2;
    const endCx = endRect.left + endRect.width / 2;
    const endCy = endRect.top + endRect.height / 2;
    const dx = endCx - startCx;
    const dy = endCy - startCy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const curveAmount = Math.min(80, len * 0.25);

    return Array.from({ length: BUBBLE_COUNT }, (_, i) => {
      const r = seeded(i + 1);
      const curve = (r - 0.5) * 2 * curveAmount;
      const midX = dx * 0.5 + perpX * curve;
      const midY = dy * 0.5 + perpY * curve;
      const sizeScale = 0.72 + seeded(i + 100) * 0.56;
      const size = Math.round(BASE_SIZE * sizeScale);
      const left = startCx - size / 2;
      const top = startCy - size / 2;
      return {
        key: i,
        left,
        top,
        size,
        dx: `${dx}px`,
        dy: `${dy}px`,
        midX: `${midX}px`,
        midY: `${midY}px`,
        delay: i * 70,
      };
    });
  }, [startRect, endRect]);

  if (!startRect || !endRect || bubbles.length === 0) return null;

  return (
    <div className="bubble-hint" aria-hidden="true">
      {bubbles.map((b) => (
        <div
          key={b.key}
          className="bubble-hint__bubble"
          style={{
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            '--bubble-dx': b.dx,
            '--bubble-dy': b.dy,
            '--bubble-mid-x': b.midX,
            '--bubble-mid-y': b.midY,
            animationDelay: `${b.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default BubbleHint;
