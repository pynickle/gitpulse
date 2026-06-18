import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

dayjs.extend(relativeTime);

type RelativeTimeDate = string | number | Date | null | undefined;

export default function (
  date: RelativeTimeDate,
  locale: string = 'en',
  baseDate?: RelativeTimeDate
): string {
  const value = dayjs(date).locale(locale);

  if (baseDate === undefined) {
    return value.fromNow();
  }

  return value.from(dayjs(baseDate));
}
