import { useEffect, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { COLORS } from '@/style/constants';

const PULSE_MIN = 0.15;
const PULSE_MAX = 0.35;
const PULSE_DURATION = 1200;

interface SkeletonPulseProps {
  width: number;
  height: number;
}

const SkeletonPulse = ({ width, height }: SkeletonPulseProps) => {
  const rectRef = useRef<Konva.Rect>(null);
  const animRef = useRef<Konva.Animation | null>(null);

  useEffect(() => {
    const node = rectRef.current;
    if (!node) return;

    let rafId: number;
    const animate = () => {
      const t = (Date.now() % PULSE_DURATION) / PULSE_DURATION;
      const opacity = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
      node.opacity(opacity);
      node.getLayer()?.batchDraw();
      rafId = requestAnimationFrame(animate);
    };

    import('konva').then((K) => {
      const anim = new K.default.Animation((frame) => {
        if (!frame) return;
        const t = (frame.time % PULSE_DURATION) / PULSE_DURATION;
        const opacity = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
        node.opacity(opacity);
      }, node.getLayer() ?? undefined);
      anim.start();
      animRef.current = anim;
    }).catch(() => {
      rafId = requestAnimationFrame(animate);
    });

    return () => {
      animRef.current?.stop();
      animRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <Group>
      <Rect
        ref={rectRef}
        x={0}
        y={0}
        width={width}
        height={height}
        fill={COLORS.inkElevated}
        cornerRadius={4}
        opacity={PULSE_MIN}
      />
      <Text
        x={0}
        y={height / 2 - 8}
        width={width}
        align="center"
        text="Generating..."
        fontSize={13}
        fontFamily="Inter, sans-serif"
        fill={COLORS.cyan}
        opacity={0.8}
      />
    </Group>
  );
};

export default SkeletonPulse;
