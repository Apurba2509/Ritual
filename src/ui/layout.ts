import { Platform, useWindowDimensions } from 'react-native';

/**
 * Adaptive layout. Ritual is a single-column app, but it must look right from a 360 dp phone to
 * an unfolded foldable or tablet (Android 16 ignores orientation locks on large screens), and on
 * the web demo, where it renders inside a phone-sized frame.
 *
 *  - Content never grows wider than a comfortable reading column (MAX_COLUMN).
 *  - "Column width" includes the 20 px side gutters, so `useFrameWidth() - 40` is the inner width.
 */
export const FRAME_WIDTH = 430;
export const FRAME_BREAKPOINT = 760;
/** Widest the content column gets on foldables / tablets / landscape (incl. gutters). */
export const MAX_COLUMN = 600;

export function useIsFramed() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= FRAME_BREAKPOINT;
}

/** Width of the content column (window width, capped for large screens and the web frame). */
export function useFrameWidth() {
  const { width } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width >= FRAME_BREAKPOINT;
  return Math.min(framed ? FRAME_WIDTH : width, MAX_COLUMN);
}

export function useFrameHeight() {
  const { height, width } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width >= FRAME_BREAKPOINT;
  return framed ? Math.min(height - 48, 900) : height;
}

/** Everything a screen needs to adapt: column width plus a few size classes. */
export function useLayout() {
  const { width: windowWidth } = useWindowDimensions();
  const width = useFrameWidth();
  const height = useFrameHeight();
  return {
    width,
    height,
    windowWidth,
    /** Short phones (or landscape): trim hero sizes. */
    compact: height < 700,
    /** Foldables, tablets, landscape: the column is centered in extra space. */
    wide: windowWidth > MAX_COLUMN,
  };
}
