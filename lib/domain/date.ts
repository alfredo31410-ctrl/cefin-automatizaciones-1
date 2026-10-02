import { APP_TIME_ZONE, MEXICO_CITY_OFFSET } from "./catalogs";

export function dateTimeLocalToIso(value: string): string {
  if (!value) return "";
  return `${value.length === 16 ? `${value}:00` : value}${MEXICO_CITY_OFFSET}`;
}

export function isoToDateTimeLocal(value: string): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatDateTime(value?: string, style: "short" | "long" = "short"): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: style === "long" ? "long" : "short",
    year: style === "long" ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function isTodayInMexico(value: string): boolean {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return format.format(new Date(value)) === format.format(new Date());
}
