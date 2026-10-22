import { addMilliseconds } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type Interval = { start: Date; end: Date };
export type TimeWindow = { start: string; end: string };

export type AvailabilityService = {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

export type ExistingBooking = {
  startsAt: Date;
  endsAt: Date;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  status?: string;
};

export type AvailabilityInput = {
  dateKey: string;
  timezone: string;
  service: AvailabilityService;
  businessHours: { opensAt: string; closesAt: string; isClosed: boolean } | null;
  staffAvailability: TimeWindow[];
  timeOff: Interval[];
  bookings: ExistingBooking[];
  holds?: Interval[];
  leadTimeMinutes?: number;
  now?: Date;
  slotStepMinutes?: number;
  maxSlots?: number;
};

export type Slot = { start: string; end: string; label: string };

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function dayStart(dateKey: string, timezone: string) {
  return fromZonedTime(`${dateKey}T00:00:00`, timezone);
}

function atMinutes(dateKey: string, timezone: string, minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return fromZonedTime(`${dateKey}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`, timezone);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function weekdayForDate(dateKey: string): number {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.getUTCDay();
}

/**
 * Pure slot calculation. The caller supplies everything needed, which makes
 * the business rules testable and prevents frontend state from being trusted.
 */
export function calculateAvailability(input: AvailabilityInput): Slot[] {
  const {
    dateKey,
    timezone,
    service,
    businessHours,
    staffAvailability,
    timeOff,
    bookings,
    holds = [],
    leadTimeMinutes = 120,
    now = new Date(),
    slotStepMinutes = 15,
    maxSlots = 48,
  } = input;

  if (!businessHours || businessHours.isClosed) return [];

  const startOfDay = dayStart(dateKey, timezone).getTime();
  const businessStart = atMinutes(dateKey, timezone, timeToMinutes(businessHours.opensAt)).getTime();
  const businessEnd = atMinutes(dateKey, timezone, timeToMinutes(businessHours.closesAt)).getTime();

  const busy: Interval[] = [
    ...bookings
      .filter((b) => !b.status || b.status === "pending" || b.status === "confirmed")
      .map((b) => ({
        start: addMilliseconds(b.startsAt, -b.bufferBeforeMinutes * 60_000),
        end: addMilliseconds(b.endsAt, b.bufferAfterMinutes * 60_000),
      })),
    ...holds,
    ...timeOff,
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  const earliestStart = Math.max(now.getTime() + leadTimeMinutes * 60_000, businessStart);
  const latestStart = businessEnd - (service.durationMinutes + service.bufferAfterMinutes) * 60_000;
  const slots: Slot[] = [];

  for (const window of staffAvailability) {
    const staffStart = atMinutes(dateKey, timezone, timeToMinutes(window.start)).getTime();
    const staffEnd = atMinutes(dateKey, timezone, timeToMinutes(window.end)).getTime();
    const rangeStart = Math.max(businessStart, staffStart);
    const rangeEnd = Math.min(businessEnd, staffEnd);

    const firstGrid = startOfDay + Math.ceil((rangeStart - startOfDay) / (slotStepMinutes * 60_000)) * slotStepMinutes * 60_000;
    let cursor = Math.max(firstGrid, earliestStart);
    // Align to the slot grid when lead time cuts into the day.
    const remainder = (cursor - startOfDay) % (slotStepMinutes * 60_000);
    if (remainder !== 0) cursor += slotStepMinutes * 60_000 - remainder;

    while (cursor <= latestStart && cursor < rangeEnd && slots.length < maxSlots) {
      const occupancyStart = cursor - service.bufferBeforeMinutes * 60_000;
      const treatmentEnd = cursor + service.durationMinutes * 60_000;
      const occupancyEnd = treatmentEnd + service.bufferAfterMinutes * 60_000;

      const insideWindow =
        occupancyStart >= Math.max(rangeStart, businessStart) &&
        occupancyEnd <= Math.min(rangeEnd, businessEnd) &&
        cursor >= earliestStart;

      const free = !busy.some((interval) =>
        overlaps(occupancyStart, occupancyEnd, interval.start.getTime(), interval.end.getTime()),
      );

      if (insideWindow && free) {
        const start = new Date(cursor);
        const end = new Date(treatmentEnd);
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          label: formatInTimeZone(start, timezone, "h:mm a"),
        });
      }
      cursor += slotStepMinutes * 60_000;
    }
  }

  return slots
    .filter((slot, index, all) => all.findIndex((candidate) => candidate.start === slot.start) === index)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function isSlotStillAvailable(slots: Slot[], candidateStartIso: string): boolean {
  const target = new Date(candidateStartIso).getTime();
  return slots.some((slot) => Math.abs(new Date(slot.start).getTime() - target) < 60_000);
}
