import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { todayKey } from '@/domain/dates';
import { completeHabit } from '@/features/habits/actions';
import { widgetState } from './data';
import { TodayWidget } from './TodayWidget';

/**
 * Runs headless (the app may be closed). Taps on a habit complete it straight from the home
 * screen; the change is saved locally and syncs the next time the app opens.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== 'Today') return;
  switch (props.widgetAction) {
    case 'WIDGET_CLICK': {
      const habitId = props.clickActionData?.habitId;
      if (props.clickAction === 'COMPLETE' && typeof habitId === 'string') {
        completeHabit(habitId, todayKey(), 'manual');
      }
      props.renderWidget(<TodayWidget state={widgetState()} />);
      break;
    }
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<TodayWidget state={widgetState()} />);
      break;
    default:
      break;
  }
}
