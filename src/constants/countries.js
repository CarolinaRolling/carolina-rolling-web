/**
 * Country of origin list for material traceability.
 *
 * IMPORTANT: country of origin is where the steel was PRODUCED (melted and poured /
 * substantially transformed) — not where it was purchased. Material bought from a local
 * service center that imported it is NOT domestic. Rolling a bar into a ring does not
 * change its origin, so whatever goes in here passes straight through to the finished ring.
 *
 * `usmca: true` marks the three USMCA parties. Only material from those three can support
 * a USMCA origin claim; everything else is non-originating.
 *
 * Kept in sync with backend/src/constants/countries.js — edit both.
 */

export const COUNTRIES = [
  // USMCA parties first — these are the ones that matter for the certificate
  { code: 'US', name: 'United States', usmca: true },
  { code: 'CA', name: 'Canada', usmca: true },
  { code: 'MX', name: 'Mexico', usmca: true },

  // Common mill origins for steel, stainless and aluminum
  { code: 'BR', name: 'Brazil', usmca: false },
  { code: 'CN', name: 'China', usmca: false },
  { code: 'DE', name: 'Germany', usmca: false },
  { code: 'ES', name: 'Spain', usmca: false },
  { code: 'FI', name: 'Finland', usmca: false },
  { code: 'FR', name: 'France', usmca: false },
  { code: 'IN', name: 'India', usmca: false },
  { code: 'IT', name: 'Italy', usmca: false },
  { code: 'JP', name: 'Japan', usmca: false },
  { code: 'KR', name: 'South Korea', usmca: false },
  { code: 'MY', name: 'Malaysia', usmca: false },
  { code: 'NL', name: 'Netherlands', usmca: false },
  { code: 'PL', name: 'Poland', usmca: false },
  { code: 'RU', name: 'Russia', usmca: false },
  { code: 'SE', name: 'Sweden', usmca: false },
  { code: 'TH', name: 'Thailand', usmca: false },
  { code: 'TR', name: 'Turkey', usmca: false },
  { code: 'TW', name: 'Taiwan', usmca: false },
  { code: 'UA', name: 'Ukraine', usmca: false },
  { code: 'UK', name: 'United Kingdom', usmca: false },
  { code: 'VN', name: 'Vietnam', usmca: false },
  { code: 'ZA', name: 'South Africa', usmca: false },
  { code: 'OTHER', name: 'Other (see MTR)', usmca: false },
];

export const USMCA_COUNTRIES = COUNTRIES.filter(c => c.usmca).map(c => c.code);

export function countryName(code) {
  if (!code) return '';
  const hit = COUNTRIES.find(c => c.code === code);
  return hit ? hit.name : code;
}

export function isUsmcaCountry(code) {
  return USMCA_COUNTRIES.includes(code);
}

export default COUNTRIES;
