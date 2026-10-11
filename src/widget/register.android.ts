import { registerWidgetTaskHandler, requestPinWidget, requestWidgetUpdate } from 'react-native-android-widget';
import { createElement } from 'react';
import { useApp } from '@/data/store';
import { widgetState } from './data';
import { widgetTaskHandler } from './handler';
import { TodayWidget } from './TodayWidget';

registerWidgetTaskHandler(widgetTaskHandler);

let timer: ReturnType<typeof setTimeout> | null = null;

/** Keep the home-screen widget in step with the app (debounced). */
export function refreshWidgetSoon(delay = 800) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    requestWidgetUpdate({
      widgetName: 'Today',
      renderWidget: () => createElement(TodayWidget, { state: widgetState() }),
    }).catch(() => {});
  }, delay);
}

let watching = false;
export function watchWidget() {
  if (watching) return;
  watching = true;
  useApp.subscribe((s, prev) => {
    if (s.entries !== prev.entries || s.habits !== prev.habits) refreshWidgetSoon();
  });
  refreshWidgetSoon(1500);
}

export const widgetSupported = true;

/** Ask the launcher to add the Today widget (shows Android's own confirmation). */
export function pinTodayWidget(): Promise<boolean> {
  return requestPinWidget({ widgetName: 'Today' }).catch(() => false);
}
