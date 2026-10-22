import { formatInTimeZone } from "date-fns-tz";

export function formatMoney(cents: number, currency = "KES", locale = "en-KE") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString()}`;
  }
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr${hours > 1 ? "s" : ""}`;
}

export function formatTime(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "h:mm a");
}

export function formatDate(date: Date, timezone: string, pattern = "EEE, d MMM") {
  return formatInTimeZone(date, timezone, pattern);
}

export function formatDateLong(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "EEEE, d MMMM yyyy");
}

export function localDateKey(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function relativeDayLabel(date: Date, timezone: string) {
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
  const target = formatInTimeZone(date, timezone, "yyyy-MM-dd");
  if (target === today) return "Today";
  const tomorrow = new Date(Date.now() + 86_400_000);
  if (formatInTimeZone(tomorrow, timezone, "yyyy-MM-dd") === target) return "Tomorrow";
  return formatDate(date, timezone, "EEE d MMM");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
