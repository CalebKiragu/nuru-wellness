import { describe, expect, it } from "vitest";
import { calculateAvailability, weekdayForDate, type AvailabilityInput } from "@/lib/availability";

const dateKey = "2026-11-10";
const timezone = "UTC";

function baseInput(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    dateKey,
    timezone,
    service: { durationMinutes: 60, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 },
    businessHours: { opensAt: "09:00", closesAt: "18:00", isClosed: false },
    staffAvailability: [{ start: "09:00", end: "17:00" }],
    timeOff: [],
    bookings: [],
    holds: [],
    leadTimeMinutes: 0,
    now: new Date("2026-11-09T09:00:00.000Z"),
    slotStepMinutes: 60,
    ...overrides,
  };
}

function labels(input: AvailabilityInput) {
  return calculateAvailability(input).map((slot) => slot.label);
}

describe("calculateAvailability", () => {
  it("offers slots inside both business and therapist hours", () => {
    expect(labels(baseInput())).toEqual([
      "9:00 AM",
      "10:00 AM",
      "11:00 AM",
      "12:00 PM",
      "1:00 PM",
      "2:00 PM",
      "3:00 PM",
      "4:00 PM",
    ]);
  });

  it("returns nothing when the studio is closed", () => {
    expect(calculateAvailability(baseInput({ businessHours: { opensAt: "09:00", closesAt: "18:00", isClosed: true } }))).toEqual([]);
    expect(calculateAvailability(baseInput({ businessHours: null }))).toEqual([]);
  });

  it("subtracts existing bookings including their buffers", () => {
    const input = baseInput({
      bookings: [
        {
          startsAt: new Date("2026-11-10T10:00:00.000Z"),
          endsAt: new Date("2026-11-10T11:00:00.000Z"),
          bufferBeforeMinutes: 15,
          bufferAfterMinutes: 15,
          status: "confirmed",
        },
      ],
    });
    expect(labels(input)).toEqual(["12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"]);
  });

  it("ignores cancelled bookings but respects holds and time off", () => {
    const input = baseInput({
      bookings: [
        {
          startsAt: new Date("2026-11-10T09:00:00.000Z"),
          endsAt: new Date("2026-11-10T10:00:00.000Z"),
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          status: "cancelled",
        },
      ],
      timeOff: [{ start: new Date("2026-11-10T13:00:00.000Z"), end: new Date("2026-11-10T15:00:00.000Z") }],
      holds: [{ start: new Date("2026-11-10T15:00:00.000Z"), end: new Date("2026-11-10T16:00:00.000Z") }],
    });
    expect(labels(input)).toEqual(["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "4:00 PM"]);
  });

  it("enforces lead time from the supplied now", () => {
    const input = baseInput({ now: new Date("2026-11-10T10:20:00.000Z"), leadTimeMinutes: 120 });
    expect(labels(input)).toEqual(["1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"]);
  });

  it("keeps the full service plus buffers inside the window", () => {
    const input = baseInput({
      service: { durationMinutes: 60, bufferBeforeMinutes: 30, bufferAfterMinutes: 30 },
      slotStepMinutes: 15,
    });
    const slots = calculateAvailability(input);
    expect(slots[0]?.label).toBe("9:30 AM");
    expect(slots.at(-1)?.label).toBe("3:30 PM");
    expect(slots.every((slot) => slot.start.endsWith("Z") && slot.end.endsWith("Z"))).toBe(true);
  });

  it("merges separate staff windows and never exceeds maxSlots", () => {
    const input = baseInput({
      staffAvailability: [
        { start: "09:00", end: "10:00" },
        { start: "14:00", end: "16:00" },
      ],
      maxSlots: 3,
    });
    expect(labels(input)).toEqual(["9:00 AM", "2:00 PM", "3:00 PM"]);
  });

  it("excludes a window that sits outside business hours", () => {
    expect(calculateAvailability(baseInput({ staffAvailability: [{ start: "18:00", end: "20:00" }] }))).toEqual([]);
  });

  it("computes weekday from a date key without local timezone drift", () => {
    expect(weekdayForDate("2026-11-10")).toBe(2);
    expect(weekdayForDate("2026-11-15")).toBe(0);
  });
});
