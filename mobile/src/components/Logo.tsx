import Svg, { Polygon, Rect } from 'react-native-svg';
import { colors } from '@/config';

export function Logo({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points="50,7 84,26 84,74 50,93 16,74 16,26" fill="#111" stroke={colors.accent} strokeWidth={3.5} />
      <Rect x={23} y={46} width={54} height={8} rx={3} fill={colors.accent} />
      <Rect x={15} y={34} width={9} height={32} rx={2.5} fill={colors.accent} />
      <Rect x={76} y={34} width={9} height={32} rx={2.5} fill={colors.accent} />
      <Rect x={24} y={39} width={6} height={22} rx={2} fill={colors.accent} />
      <Rect x={70} y={39} width={6} height={22} rx={2} fill={colors.accent} />
    </Svg>
  );
}
