import { describe, expect, it } from "vitest";
import { attendancePercent, isLowAttendance } from "@/lib/attendance";

describe("attendance rules", () => {
  it("percentage = attended / conducted × 100", () => {
    expect(attendancePercent(15, 20)).toBe(75);
    expect(attendancePercent(2, 3)).toBe(66.7);
    expect(attendancePercent(0, 0)).toBe(0);
  });
  it("warns below 75% only", () => {
    expect(isLowAttendance(74.9, 10)).toBe(true);
    expect(isLowAttendance(75, 10)).toBe(false);
    expect(isLowAttendance(0, 0)).toBe(false);
  });
});
