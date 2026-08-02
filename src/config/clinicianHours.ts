/**
 * Static, per-project simplification (spec Section 2 explicitly allows this):
 * every clinician shares the same working hours instead of a per-clinician
 * schedule table. Good enough to compute availability for a portfolio
 * project; a real deployment would move this into its own table.
 */
export const WORKING_HOURS = {
  startHourUtc: 9,
  endHourUtc: 17,
  slotMinutes: 30,
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri, JS Date#getUTCDay()
} as const;
