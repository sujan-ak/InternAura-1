/**
 * Filter parsing — fixes gap #17.
 * PLACE AT: artifacts/internaura/lib/filters.ts
 *
 * THE BUGS THIS FIXES  (all in app/(tabs)/index.tsx)
 * --------------------------------------------------
 * stipendValue() (line 58):
 *     Number((x.match(/[0-9]+/) || ["0"])[0]) * 1000
 *   Took the first digit run and multiplied by 1000 unconditionally.
 *     "₹35k / month"    -> 35000  correct BY LUCK
 *     "₹1,20,000/month" -> 1000   WRONG by 120x
 *     "₹45,833/month"   -> 45000  off by 833
 *     "Competitive"     -> 0      so every Adzuna job with no listed salary was
 *                                 filtered out by any stipend floor
 *
 * months() (line 61):
 *   Also took only the first number, so Adzuna's "3 - 6 months" -> 3, and the
 *   "3-6 months" bucket required m > 3. A 3-6 month internship could NEVER match
 *   the 3-6 month filter.
 *
 * mode (line 389): `x.workMode !== filters.mode` exact equality. Adzuna sets
 *   "On-site / Hybrid", which equals neither "On-site" nor "Hybrid", so live
 *   jobs vanished the moment any mode filter was applied.
 *
 * skills (line 407/409): `itemSkills.includes(s)` — case-sensitive exact match,
 *   same root cause as gap #11.
 */

import { canonicalizeSkill } from "@workspace/db/skill-normalizer";

// ---------------------------------------------------------------------------
// Stipend
// ---------------------------------------------------------------------------

/**
 * Parse a stipend string to rupees PER MONTH.
 * Returns null when there is no parseable figure ("Competitive Stipend"), so
 * callers can distinguish "unknown" from "zero" — the old code conflated them.
 */
export function parseStipendMonthly(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();

  if (/unpaid|no stipend|not disclosed/.test(s)) return 0;

  const m = s.match(/(\d[\d,.]*)\s*(k|l|lakh|lpa)?/);
  if (!m) return null;

  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;

  const unit = m[2];
  if (unit === "k") n *= 1_000;
  else if (unit === "l" || unit === "lakh" || unit === "lpa") n *= 100_000;

  if (/year|annum|\/yr|\bpa\b|lpa/.test(s)) n /= 12;

  return Math.round(n);
}

/** Unknown stipends PASS a floor filter rather than being silently dropped. */
export function matchesStipendFloor(raw: string | null | undefined, floor: number): boolean {
  if (floor <= 0) return true;
  const value = parseStipendMonthly(raw);
  if (value === null) return true;
  return value >= floor;
}

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

export interface DurationRange {
  min: number;
  max: number;
}

/** Parse to a month RANGE. "3 - 6 months" -> {min:3,max:6}; "8 weeks" -> ~1.84. */
export function parseDurationMonths(raw: string | null | undefined): DurationRange | null {
  if (!raw) return null;
  const nums = (String(raw).match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
  if (nums.length === 0) return null;

  const isWeeks = /week/i.test(raw);
  const toMonths = (n: number) => (isWeeks ? n / 4.345 : n);

  return { min: toMonths(Math.min(...nums)), max: toMonths(Math.max(...nums)) };
}

export type DurationBucket = "Any" | "<1 month" | "1-3 months" | "3-6 months" | "6+ months";

/**
 * Overlap semantics: a 3-6 month posting matches BOTH "1-3" and "3-6", because
 * it genuinely could be either. "6+" requires min >= 6 so it means "at least six
 * months guaranteed" rather than "might reach six".
 */
export function matchesDurationBucket(
  raw: string | null | undefined,
  bucket: DurationBucket,
): boolean {
  if (bucket === "Any") return true;
  const r = parseDurationMonths(raw);
  if (!r) return true; // unknown duration shouldn't be silently hidden

  switch (bucket) {
    case "<1 month":
      return r.min < 1;
    case "1-3 months":
      return r.max >= 1 && r.min <= 3;
    case "3-6 months":
      return r.max >= 3 && r.min <= 6;
    case "6+ months":
      return r.min >= 6;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Work mode
// ---------------------------------------------------------------------------

/** Tolerant of compound values like Adzuna's "On-site / Hybrid". */
export function matchesWorkMode(
  itemMode: string | null | undefined,
  filterMode: string,
): boolean {
  if (!filterMode || filterMode === "Any") return true;
  if (!itemMode) return false;

  const item = itemMode.toLowerCase();
  const want = filterMode.toLowerCase();

  if (item === want) return true;
  if (item.includes(want)) return true; // "on-site / hybrid" contains "hybrid"

  // "On-site" vs "Onsite" vs "In-office"
  const collapse = (s: string) => s.replace(/[^a-z]/g, "");
  return collapse(item).includes(collapse(want));
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/** Canonicalised comparison, so "react" matches "React.js". */
export function matchesSkills(
  itemSkills: readonly string[],
  wanted: readonly string[],
  mode: "ANY" | "ALL",
): boolean {
  if (!wanted || wanted.length === 0) return true;

  const have = new Set(itemSkills.map((s) => canonicalizeSkill(s).toLowerCase()));
  const test = (s: string) => have.has(canonicalizeSkill(s).toLowerCase());

  return mode === "ALL" ? wanted.every(test) : wanted.some(test);
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type SortKey = "Best Match" | "Highest Stipend" | "Shortest Duration";

export function compareBySort(a: any, b: any, sort: SortKey): number {
  switch (sort) {
    case "Highest Stipend":
      return (parseStipendMonthly(b?.stipend) ?? -1) - (parseStipendMonthly(a?.stipend) ?? -1);
    case "Shortest Duration": {
      const ra = parseDurationMonths(a?.duration);
      const rb = parseDurationMonths(b?.duration);
      return (ra?.min ?? Number.MAX_SAFE_INTEGER) - (rb?.min ?? Number.MAX_SAFE_INTEGER);
    }
    default:
      // No `|| 85` fallback. Items with no score sort last instead of pretending.
      return (b?.atsScore ?? -1) - (a?.atsScore ?? -1);
  }
}
