import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';

dayjs.extend(duration);
dayjs.extend(relativeTime);

export default function (date: string, locale: string = 'en'): string {
  return dayjs(date).locale(locale).fromNow();
}
