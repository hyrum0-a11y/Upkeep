import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { entryLabel, formatCost, formatDate, formatReading, mileageChart, toISODate, type Meter, type SheetData } from '../lib/format';
import { Card, Chip, Row, colors, text } from './ui';

const RANGES = [
  ['3y', 3],
  ['5y', 5],
  ['All', 0],
] as const;
type Range = (typeof RANGES)[number][0];

const H = 150; // plot height
const PAD = { top: 18, bottom: 6, left: 4, right: 18 };
const R_MIN = 4;
const R_MAX = 16;

/** Mileage over time for one vehicle, with a circle per paid service sized by cost (area ∝ cost). */
export function MileageChart({ item, data, meter }: { item: string; data: SheetData; meter: Meter }) {
  const [range, setRange] = useState<Range>('3y');
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const years = RANGES.find(([k]) => k === range)![1];
  const today = toISODate(new Date());
  const start = years ? `${Number(today.slice(0, 4)) - years}${today.slice(4)}` : '';
  const { points, markers } = mileageChart(item, data, start);

  const dates = [...points.map((p) => p.date), ...markers.map((mk) => mk.entry.date)];
  const t0 = Date.parse(start || dates.reduce((a, b) => (a < b ? a : b), today));
  const t1 = Date.parse(today);
  const readings = [...points.map((p) => p.reading), ...markers.map((mk) => mk.reading)];
  const lo = readings.length ? Math.min(...readings) : 0;
  const hi = readings.length ? Math.max(...readings) : 1;
  const span = hi - lo || 1;
  const maxCost = Math.max(1, ...markers.map((mk) => mk.entry.cost ?? 0));

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const x = (d: string) => PAD.left + (t1 > t0 ? ((Date.parse(d) - t0) / (t1 - t0)) * plotW : plotW);
  const y = (r: number) => PAD.top + (1 - (r - lo) / span) * (H - PAD.top - PAD.bottom);
  const radius = (cost: number) => Math.max(R_MIN, Math.sqrt(cost / maxCost) * R_MAX);

  const sel = markers.find((mk) => mk.entry.id === picked);

  return (
    <Card style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={text.section}>Mileage & spending</Text>
        <Row style={{ gap: 6 }}>
          {RANGES.map(([k]) => (
            <Chip key={k} label={k} selected={range === k} onPress={() => (setRange(k), setPicked(null))} />
          ))}
        </Row>
      </Row>
      {points.length + markers.length === 0 ? (
        <Text style={text.muted}>No readings in this range yet.</Text>
      ) : (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <Text style={[styles.axis, { top: 0, left: 0 }]}>{formatReading(hi, meter)}</Text>
          {width > 0 && (
            <Svg width={width} height={H}>
              <Line x1={PAD.left} x2={width - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke={colors.border} strokeWidth={1} />
              {points.length > 1 && (
                <Polyline
                  points={points.map((p) => `${x(p.date)},${y(p.reading)}`).join(' ')}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              )}
              {points.map((p) => (
                <Circle key={p.id} cx={x(p.date)} cy={y(p.reading)} r={2} fill={colors.primary} />
              ))}
              {markers.map((mk) => {
                const color = mk.entry.troubleshooting ? colors.danger : colors.warn;
                const r = radius(mk.entry.cost ?? 0);
                const id = mk.entry.id;
                return [
                  <Circle
                    key={`${id}-c`}
                    cx={x(mk.entry.date)}
                    cy={y(mk.reading)}
                    r={r}
                    fill={color}
                    fillOpacity={picked === id ? 0.8 : 0.4}
                    stroke={color}
                    strokeWidth={picked === id ? 2 : 1}
                  />,
                  <Circle
                    key={`${id}-hit`}
                    cx={x(mk.entry.date)}
                    cy={y(mk.reading)}
                    r={Math.max(r, 14)}
                    fill="transparent"
                    onPress={() => setPicked(picked === id ? null : id)}
                  />,
                ];
              })}
            </Svg>
          )}
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={styles.axisInline}>{formatDate(new Date(t0).toISOString())}</Text>
            <Text style={styles.axisInline}>{today}</Text>
          </Row>
        </View>
      )}
      {sel ? (
        <Text style={text.body} onPress={() => sel.entry.id && router.push({ pathname: '/add', params: { id: sel.entry.id } })}>
          {formatDate(sel.entry.date)} · {entryLabel(sel.entry)} · {formatCost(sel.entry.cost)}
          {sel.entry.reading !== null ? ` · ${formatReading(sel.entry.reading, meter)}` : ''}
          <Text style={{ color: colors.primary }}> Open ›</Text>
        </Text>
      ) : markers.length ? (
        <Text style={text.muted}>
          Circles = money spent (bigger = more). <Text style={{ color: colors.danger }}>●</Text> troubleshooting. Tap one for details.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  axis: { position: 'absolute', fontSize: 11, color: colors.muted, zIndex: 1 },
  axisInline: { fontSize: 11, color: colors.muted },
});
