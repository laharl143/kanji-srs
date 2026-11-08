import { startOfLocalHour } from "@/lib/srs/forecast";

// Visible label for a Next 24 hours row (spec 0008 Value sourcing): the device locale's hour
// ("3 PM"), "This hour" for the current hour, and "Tomorrow" before an hour on the next day.
export function forecastLabel(
  hourStart: number,
  now: number,
  formatHour: (time: number) => string = localHour,
): string {
  if (hourStart === startOfLocalHour(now)) return "This hour";
  const hour = formatHour(hourStart);
  return new Date(hourStart).toDateString() === new Date(now).toDateString()
    ? hour
    : `Tomorrow ${hour}`;
}

export function forecastRowLabel(
  row: { hourStart: number; count: number; runningTotal: number },
  now: number,
  formatHour?: (time: number) => string,
): string {
  const when = forecastLabel(row.hourStart, now, formatHour);
  const more = `${row.count} more ${row.count === 1 ? "review" : "reviews"}`;
  const spoken =
    when === "This hour"
      ? when
      : when.startsWith("Tomorrow ")
        ? `Tomorrow at ${when.slice("Tomorrow ".length)}`
        : `At ${when}`;
  return `${spoken}, ${more}, ${row.runningTotal} total`;
}

function localHour(time: number): string {
  return new Date(time).toLocaleTimeString(undefined, { hour: "numeric" });
}
