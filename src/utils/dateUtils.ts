import { format, isToday, isYesterday, startOfWeek, addDays, differenceInDays } from 'date-fns';

export const formatDate = (dateString: string | Date, formatStr: string = 'MMM d, yyyy') => {
  return format(new Date(dateString), formatStr);
};

export const getDaysBetween = (start: Date, end: Date) => {
  return Math.abs(differenceInDays(start, end));
};

export const getWeekDays = (date: Date = new Date()) => {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday start
  return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
};

export { isToday, isYesterday };
