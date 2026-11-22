import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { entryLabel, formatCost, formatDate, formatReading, mileageChart, toISODate, type Meter, type SheetData } from '../lib/format';
import { Card, Chip, Row, colors, text } from './ui';

type Range = '3y' | '5y' | 'All';

const H = 160; // plot height
const R_MIN = 4;
const R_MAX = 14;
const PAD = { top: R_MAX + 4, bottom: R_MAX + 4, left: 46, right: R_MAX + 4 }; // left leaves room for y labels

/** 186234 → "186.2K" (axis labels only; logs stay to the mile). */
const kLabel = (n: number) => `${(n / 1000).toFixed(1)}K`;

/** `years` before today as yyyy-mm-dd. */
const yearsAgo = (today: string, years: number) => `${Number(today.slice(0, 4)) - years}${today.slice(4)}`;

/** Mileage over time for one vehicle, with a circle per paid service sized by cost (area ∝ cost). */
export function MileageChart({ item, data, meter }: { item: string; data: SheetData; meter: Meter }) {
  const today = toISODate(new Date());
  const all = mileageChart(item, data, '');
  const firstDate = [...all.points.map((p) => p.date), ...all.markers.map((mk) => mk.entry.date)].sort()[0] ?? today;
  // Only offer 3y / 5y when there's more history than that.
  const ranges: Range[] = [
    ...(firstDate < yearsAgo(today, 3) ? (['3y'] as const) : []),
    ...(firstDate < yearsAgo(today, 5) ? (['5y'] as const) : []),
  ];
  if (ranges.length) ranges.push('All');

  const [range, setRange] = useState<Range>('3y');
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const active: Range = ranges.includes(range) ? range : 'All';
  const start = active === '3y' ? yearsAgo(today, 3) : active === '5y' ? yearsAgo(today, 5) : '';
  const { points, markers } = start ? mileageChart(item, data, start) : all;

  const dates = [...points.map((p) => p.date), ...markers.map((mk) => mk.entry.date)].sort();
  const t0 = Date.parse(start || dates[0] || today);
  const t1 = Date.parse(today);
  const readings = [...points.map((p) => p.reading), ...markers.map((mk) => mk.reading)];
  const lo = readings.length ? Math.min(...readings) : 0;
  const hi = readings.length ? Math.max(...readings) : 1;
  const span = hi - lo || 1;
  const maxCost = Math.max(1, ...markers.map((mk) => mk.entry.cost ?? 0));

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const x = (d: string) => PAD.left + (t1 > t0 ? ((Date.parse(d) - t0) / (t1 - t0)) * plotW : plotW / 2);
  const y = (r: number) => PAD.top + (hi === lo ? plotH / 2 : (1 - (r - lo) / span) * plotH);
  const radius = (cost: number) => Math.max(R_MIN, Math.sqrt(cost / maxCost) * R_MAX);

  const sel = markers.find((mk) => mk.entry.id === picked);

  return (
    <Card style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={text.section}>Mileage & spending</Text>
        {ranges.length > 0 && (
          <Row style={{ gap: 6 }}>
            {ranges.map((k) => (
              <Chip key={k} label={k} selected={active === k} onPress={() => (setRange(k), setPicked(null))} />
            ))}
          </Row>
        )}
      </Row>
      {points.length + markers.length === 0 ? (
        <Text style={text.muted}>No readings in this range yet.</Text>
      ) : (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <Svg width={width} height={H}>
              <Line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(hi)}
                y2={y(hi)}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <Line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(lo)}
                y2={y(lo)}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              {points.length > 1 && (
                <Polyline
                  points={points.map((p) => `${x(p.date)},${y(p.reading)}`).join(' ')}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              )}
              {points.map((p) => (
                <Circle key={p.id} cx={x(p.date)} cy={y(p.reading)} r={2.5} fill={colors.primary} />
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
          {width > 0 && (
            <>
              <Text style={[styles.yLabel, { top: y(hi) - 7 }]}>{kLabel(hi)}</Text>
              {hi !== lo && <Text style={[styles.yLabel, { top: y(lo) - 7 }]}>{kLabel(lo)}</Text>}
            </>
          )}
          <Row style={{ justifyContent: 'space-between', paddingLeft: PAD.left }}>
            <Text style={styles.xLabel}>{formatDate(new Date(t0).toISOString())}</Text>
            <Text style={styles.xLabel}>{today}</Text>
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
        <Text style={styles.legend} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          Bigger circle = more spent · <Text style={{ color: colors.danger }}>●</Text> troubleshooting · tap for details
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute', left: 0, width: PAD.left - 6, textAlign: 'right', fontSize: 11, color: colors.muted },
  xLabel: { fontSize: 11, color: colors.muted },
  legend: { fontSize: 12, color: colors.muted },
});
