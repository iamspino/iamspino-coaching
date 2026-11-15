import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '@/config';
import { fmtDate } from '@/lib/format';
import { Txt } from './ui';

export interface Point { date: string; value: number }

/** Grafico a linea semplice per l'andamento nel tempo (peso, massimali…). */
export function LineChart({ points, unit = '', color = colors.accent, height = 170 }: {
  points: Point[]; unit?: string; color?: string; height?: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length === 0) return <Txt v="muted">Nessun dato ancora.</Txt>;

  const padL = 40, padR = 12, padT = 14, padB = 24;
  const values = points.map(p => p.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  min -= range * 0.1; max += range * 0.1;
  const w = Math.max(0, width - padL - padR), h = height - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => padT + h - ((v - min) / (max - min)) * h;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [max, (max + min) / 2, min];
  const first = points[0]!, last = points[points.length - 1]!;
  const diff = last.value - first.value;

  return (
    <View onLayout={onLayout}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <Txt v="title" color={color}>{fmtNum(last.value)}{unit}</Txt>
        {points.length > 1 ? (
          <Txt v="small" color={diff === 0 ? colors.muted : diff > 0 ? colors.blue : colors.green}>
            {diff > 0 ? '+' : ''}{fmtNum(diff)}{unit} dal {fmtDate(first.date)}
          </Txt>
        ) : null}
      </View>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((t, i) => (
            <Line key={i} x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={colors.border} strokeDasharray="3,4" />
          ))}
          {ticks.map((t, i) => (
            <SvgText key={'t' + i} x={padL - 6} y={y(t) + 4} fill={colors.muted} fontSize={10} textAnchor="end">{fmtNum(t)}</SvgText>
          ))}
          <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => <Circle key={i} cx={x(i)} cy={y(p.value)} r={points.length > 30 ? 0 : 3.5} fill={color} />)}
          <SvgText x={padL} y={height - 6} fill={colors.muted} fontSize={10}>{fmtDate(first.date)}</SvgText>
          {points.length > 1 ? <SvgText x={width - padR} y={height - 6} fill={colors.muted} fontSize={10} textAnchor="end">{fmtDate(last.date)}</SvgText> : null}
        </Svg>
      ) : <View style={{ height }} />}
    </View>
  );
}

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}
