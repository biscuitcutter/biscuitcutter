/**
 * Simple strftime implementation for common format codes.
 */
export function strftime(format: string, date: Date): string {
  const pad = (n: number, width: number = 2): string => String(n).padStart(width, '0');

  return format.replace(/%[YmdHIMSpBbAa%]/g, (match) => {
    switch (match) {
      case '%Y':
        return String(date.getFullYear());
      case '%m':
        return pad(date.getMonth() + 1);
      case '%d':
        return pad(date.getDate());
      case '%H':
        return pad(date.getHours());
      case '%I': {
        const h = date.getHours() % 12;
        return pad(h === 0 ? 12 : h);
      }
      case '%M':
        return pad(date.getMinutes());
      case '%S':
        return pad(date.getSeconds());
      case '%p':
        return date.getHours() >= 12 ? 'PM' : 'AM';
      case '%B': {
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ];
        return months[date.getMonth()];
      }
      case '%b': {
        const monthsShort = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        ];
        return monthsShort[date.getMonth()];
      }
      case '%A': {
        const days = [
          'Sunday', 'Monday', 'Tuesday', 'Wednesday',
          'Thursday', 'Friday', 'Saturday',
        ];
        return days[date.getDay()];
      }
      case '%a': {
        const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return daysShort[date.getDay()];
      }
      case '%%':
        return '%';
      default:
        return match;
    }
  });
}
