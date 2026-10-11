import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetState } from './data';

const INK = '#0B0B0C';
const SURFACE = '#1C1C1E';
const BONE = '#F4F4F1';
const MUTED = '#8F8F8A';
const VOLT = '#D4FF3F';
const FONT_BOLD = 'InterTight_700Bold';
const FONT_MEDIUM = 'InterTight_500Medium';

/** The day ring as an SVG string (same geometry as the in-app DayRing). */
function ringSvg(segments: number[], done: number, total: number, size = 112): string {
  const stroke = 11;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const n = Math.max(1, segments.length);
  const slice = 360 / n;
  const gap = n === 1 ? 0 : Math.max(6, 14 - n);
  const cap = n === 1 ? 0 : (stroke / 2 / r) * (180 / Math.PI);
  const segLen = ((slice - gap - cap * 2) / 360) * c;
  const cx = size / 2;
  const arcs = (segments.length ? segments : [0])
    .map((p, i) => {
      const rot = -90 + i * slice + gap / 2 + cap;
      const dash = n === 1 ? `${c} ${c}` : `${segLen} ${c}`;
      const fill =
        p > 0.005
          ? `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${VOLT}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(n === 1 ? c : segLen) * Math.min(1, p)} ${c * 2}" transform="rotate(${rot} ${cx} ${cx})"/>`
          : '';
      return `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#2A2A2D" stroke-width="${stroke}" stroke-linecap="${n === 1 ? 'butt' : 'round'}" stroke-dasharray="${dash}" transform="rotate(${rot} ${cx} ${cx})"/>${fill}`;
    })
    .join('');
  const label =
    total === 0
      ? `<text x="${cx}" y="${cx + 6}" font-size="17" font-weight="700" fill="${BONE}" text-anchor="middle" font-family="sans-serif">Free</text>`
      : done === total
        ? `<path d="M${cx - 14} ${cx} l9 9 l19 -20" fill="none" stroke="${VOLT}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<text x="${cx}" y="${cx + 11}" font-size="34" font-weight="800" fill="${BONE}" text-anchor="middle" font-family="sans-serif">${done}<tspan font-size="18" fill="${MUTED}">/${total}</tspan></text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}${label}</svg>`;
}

export function TodayWidget({ state }: { state: WidgetState }) {
  const allDone = state.total > 0 && state.done === state.total;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`Ritual: ${state.done} of ${state.total} habits done today`}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: INK,
        borderRadius: 26,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: 14,
      }}
    >
      <SvgWidget svg={ringSvg(state.segments, state.done, state.total)} style={{ width: 112, height: 112 }} />
      <FlexWidget
        style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', flexGap: 6 }}
      >
        {state.empty ? (
          <TextWidget
            text="Open Ritual to add your first habit"
            style={{ fontSize: 14, color: BONE, fontFamily: FONT_MEDIUM }}
          />
        ) : allDone ? (
          <>
            <TextWidget text="Perfect day" style={{ fontSize: 18, color: BONE, fontFamily: FONT_BOLD }} />
            <TextWidget
              text="Everything done. See you tomorrow."
              style={{ fontSize: 12, color: MUTED, fontFamily: FONT_MEDIUM }}
            />
          </>
        ) : (
          <>
            <TextWidget text="Up next" style={{ fontSize: 12, color: MUTED, fontFamily: FONT_MEDIUM }} />
            {state.next.map((h) => (
              <FlexWidget
                key={h.id}
                clickAction="COMPLETE"
                clickActionData={{ habitId: h.id }}
                accessibilityLabel={`Mark ${h.name} done`}
                style={{
                  width: 'match_parent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexGap: 10,
                  backgroundColor: SURFACE,
                  borderRadius: 14,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              >
                <FlexWidget
                  style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#5C5C57' }}
                />
                <TextWidget
                  text={h.name}
                  maxLines={1}
                  truncate="END"
                  style={{ fontSize: 14, color: BONE, fontFamily: FONT_BOLD }}
                />
              </FlexWidget>
            ))}
          </>
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
