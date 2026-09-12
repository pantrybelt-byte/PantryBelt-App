/**
 * utils/mapEligibility.ts — Client-side map-pin eligibility overlay for `agencies`.
 *
 * ⚠ FROZEN SNAPSHOT — STALE BY CONSTRUCTION. The ID lists below are a
 * one-time dump from the 2026-09 audit (tools/unverified-audit-report.json,
 * generated 2026-09-12). They are hardcoded doc IDs, not a live query, so
 * they do NOT update themselves: a pantry whose coordinates get fixed after
 * this date stays on the ineligible list forever (a false positive), and any
 * new bad-coordinate doc added by a future import — a duplicate geocode, an
 * out-of-county pin — is invisible to this file until someone manually
 * regenerates it (a false negative). Nothing here re-checks live data at
 * runtime. Before any future data import, seed script, or bulk geocode pass,
 * re-run `node tools/auditUnverifiedAgencies.js` to produce a fresh
 * unverified-audit-report.json, then regenerate these two arrays from it —
 * `node tools/verifyMapEligibility.js` will tell you if this file has
 * drifted from that report (current expected union: 115 IDs).
 *
 * Computed at read time only — never written back to Firestore, and no
 * documents are deleted or merged. Doc IDs sourced from the read-only audit
 * in tools/unverified-audit-report.json (generated 2026-09-12 by
 * tools/auditUnverifiedAgencies.js), which only evaluates unverified docs
 * (verified !== true) — a doc here is always unverified by construction.
 *
 * A doc is NOT mapEligible when either:
 *  - its coordinates match another doc's to 5 decimal places
 *    (`placeholder_coords_repeated_x2..x6` — shared/placeholder coordinates), or
 *  - its coordinates fall outside the bounding box of the county named on the
 *    record (`coords_outside_county_bounds`).
 * Non-eligible docs are still fully valid records — they just don't get a pin
 * dropped at an unconfirmed or colliding location. Re-run the audit script
 * and regenerate this list after new imports/geocoding passes.
 */

const COORD_DUPLICATE_IDS: string[] = [
  '0nj4TGnRlN4417jzwBWk',
  '0zXAXOK0LXlsX3U2IGhT',
  '1OLbA3kNdM3dRdwVymVw',
  '21UaTtW6cISOuyn4SH8Y',
  '4EWelLqeYFetqIKGLeeg',
  '5E8DSFBeJNWvWXKUqJVT',
  '6vOdFytI1mKQVAUnPgwn',
  '7xtaNvT0vKkeizzeOXQF',
  '9IvWqComYq5vbsvwtzcw',
  '9vZctReMcYWf22c3SuXP',
  'BACCMBEbApOnNuYj3PsS',
  'BAN0oITCjZJmLX0jEHHh',
  'CaZmL4vPwkbe9YxzRhdu',
  'CxiiJnZzCTSRdBlxHykA',
  'FQJM0SlrazOAQBFedeH1',
  'HqKXhBerOiiruQzOIe4j',
  'IW2yblAgXAHBhsjnTybF',
  'JwWYp1453fmEj0EUuRk4',
  'KTs9dFuUQF1awHablWUT',
  'KYz4fYXEcL31xZnhpqji',
  'LHgVpKqXw5kE4MT003Iz',
  'LJXDCQy6ObFN01wSNnUm',
  'MavqptEPSuNKY0zrxw4v',
  'N0c0OA5lNzxWfRqVrbiJ',
  'PRjn44xL6yzPOYV11bx6',
  'PU3WVmHmHcbtFAW9uCHm',
  'PusVQuGCVHZ1DwZAGfFT',
  'QzFHHAQ4LZ7gAhQMgTok',
  'RgYVJiiwup6WlfRErB6x',
  'TM0AepxDeHrZjJ35jOit',
  'TVnsPEB0tTAOVGOkaS86',
  'Ta6KJZBNczQ8jbbyYAlu',
  'TfeKVlSkKNvHxGC7F7AZ',
  'TksE9ag7tDELf42QEm5r',
  'U7I2aDm07DxmAciQbnRV',
  'UOb6IIdr2tBXPmhDCsGB',
  'WjRk7dFEwsXsK7hiEeJc',
  'ZNR31EFedYki9BoVyxRq',
  'bivszCHo6eFwjkL0TVw4',
  'dPyaXY5C5aC5jCBeEqIJ',
  'dx8Etr6nMkDjw159PXgf',
  'g7lvRaWTtPv7ecoVPOZL',
  'k3iWcSupS69sDUjK92bP',
  'l9uMoQqn2PWxGBPI1usb',
  'mWT9lc2rwuJBynyKIZet',
  'q7wYd0iOiptBreTDzdTv',
  'qTYArh2dUqswYXqgaoKS',
  'res_per_002',
  'ssRxzFIaiUuAUZYYTvyK',
  'tEUvaVaVLP79qwo8AO4A',
  'u46CSuIrRWwvZuyHU3cy',
  'ublxNadpy2zNr7Cv9jmd',
  'uxQh1KaztBlmbZkFlbpM',
  'vASK9ow1QPFJVSIkb5vz',
  'wEXjarrMbgthZeODYMj2',
  'zW7xtz0bVVOoJVKPiFce',
];

const COORD_OUT_OF_COUNTY_IDS: string[] = [
  '3q6sgNfeVQPF1CAmwmN1',
  '4FiRdkF80c0MyX12HqPP',
  '4R8OJYKZcKA8k0zYbhKQ',
  '4ePu8z3HEz6DTqqxQdTo',
  '8iPxghY8rWp4udObJjIp',
  '8nnwTPmKIaAAQx3tugP0',
  '94gfhAr9INJzT03gyTJh',
  'BACCMBEbApOnNuYj3PsS',
  'BOQgFGpPjRLejy7ltQzK',
  'BR4O49H2E7enhZeDlycI',
  'BbL2rQIRdwbAOV6Gx0m1',
  'BgFiIMdSmhRNEkkg8Afg',
  'CmxxjQyzdKakhFpnrM5G',
  'E5j1wrMo1e0T8qMOHVCG',
  'E7Uk23dRXFOzQSy4ILEu',
  'HFSYhxMQqowShczZ5b4M',
  'HfnNQl28Fugsqlw3P0KW',
  'JDgP8NUKFaZYNhmyv7pB',
  'LCQV5jd17JDMPp9TDn25',
  'LP8jaXstJkerEXUAppRV',
  'LpjPJJPtozS0rWf1FpuT',
  'OEqfciJp42dGSKivjf5h',
  'OHHe6MgKJ1CITzQcRR59',
  'PaBBudu1Z9t2chNlV70R',
  'Q7xKhjk34m140LEwNHv9',
  'QAC57jXNzYyVUW41fRsQ',
  'UGRPyyET2Ka0jwuQFH2i',
  'UuGNAT7799UmJL1ECPSf',
  'WUWLGgN5DxwR8axhi3Kf',
  'WpEDhHaqRBFlYBkzJMf7',
  'XR9E6id7oMLWNTJxT0Lf',
  'XT4cMXWtEJQv5yI4UPjw',
  'XZXFzSDVoosrdrs8Pk8X',
  'Y9MGEujxFcbeNDCwt0wp',
  'YRDs9EpYXwtr63TogIYq',
  'ZQ8uoYSqTyVDM5WWnwHc',
  'ZfKXgRQvpMF89fUTQFvw',
  'adU557wFcL1njkhtbhNe',
  'aeijlgFYSP33lr6pzizB',
  'dPOsK6JCg1nVKnszT5rC',
  'eeug3pY8BaCL2TVBzw7B',
  'h2VNgXnOVZ1isqHE0MFp',
  'hUuv6bgPA5dtPFP2kZmQ',
  'iRkdjtaehedtIdCGRRDW',
  'iUvTO8Ihlhfws3bNWX31',
  'j2n4Jh1otodx2YqesFI7',
  'kGeO8mLSkoEG26nmNUl5',
  'l5ZbUWsCpusbQPsIrcaf',
  'nO3fN5WWERi8gDDeSeTI',
  'nd5qh43KXRmFwVJwKSwM',
  'npb2fX2CRCZyGYVlevOY',
  'pkJxbonxdTNaaZe9zl15',
  'pnzwmxIkmyOrgbWTGoaZ',
  'rS00RJkGnPG3GH7sd0QL',
  'tkTOmlewkY9vuEK2zrGg',
  'ublxNadpy2zNr7Cv9jmd',
  'vDpJCzTtBKx91gh8Hj2o',
  'xbytkwdsus9Fv8RpPUag',
  'y3TjgGQhQDVDdHQboA1I',
  'yJupMdjgdmJZ5InJG04A',
  'zD7TRUUIaig2iyRlAT77',
];

const MAP_INELIGIBLE_IDS: ReadonlySet<string> = new Set([
  ...COORD_DUPLICATE_IDS,
  ...COORD_OUT_OF_COUNTY_IDS,
]);

export function computeMapEligible(id: string): boolean {
  return !MAP_INELIGIBLE_IDS.has(id);
}

/**
 * `website_is_directory_listing` — 9 docs whose stored `website` points at a
 * regional/aggregator directory (feedingamerica.org/find-your-local-foodbank
 * and similar) rather than a pantry-specific page. Stripped at render time
 * only; the underlying Firestore field is left untouched.
 */
const DIRECTORY_WEBSITE_IDS: ReadonlySet<string> = new Set([
  '2cEcXnpFcITRBT3JItIi',
  '3rSkOnIZfAsGDAGIpeQ7',
  '9j1rZYWqrej3pwoNbPRT',
  'JDgP8NUKFaZYNhmyv7pB',
  'RFtFz6gjnE70bbFpwJdF',
  'ZTVrMXgVRIutgcTnHmqt',
  'l5ZbUWsCpusbQPsIrcaf',
  'res_per_002',
  'szr7102Ep3ZLLI7MAWod',
]);

export function sanitizeWebsite(id: string, website: string): string {
  return DIRECTORY_WEBSITE_IDS.has(id) ? '' : website;
}
