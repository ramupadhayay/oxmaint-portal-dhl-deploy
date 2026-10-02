'use client'

// The country list the add-site form picks from.
//
// Country was a free-text box, and on a field the scope filter groups by that
// is a trap: the header's geography is built by grouping sites on the exact
// string in this column, so "France" and "france" are two countries, and a
// site typed as "United States" sits in a second bucket from the two already
// filed under "USA". Nobody sees the mistake until the filter shows two
// countries where there is one.
//
// ── the register's own spelling wins ──────────────────────────────────────
//
// Whatever is already in the register is offered first and exactly as written,
// because that is what the existing sites are grouped under. The register says
// "USA", so the picker says USA — correcting it here to "United States" would
// be correcting a spelling in the form while leaving the two sites it belongs
// to under the old one, which is the bug this list exists to prevent.
//
// A country in the list that duplicates one of those is dropped rather than
// shown twice; see `countryOptions`.

import { SITES } from './data'

/**
 * ISO 3166 common names, alphabetically.
 *
 * The whole list rather than the handful WAGA operates in today. A picker that
 * offers six countries and no way to say a seventh is worse than the text box
 * it replaced — the client adds a site where the client has a site.
 */
export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
  'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain',
  'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
  'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Congo', 'Congo (DRC)', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana',
  'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti',
  'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
  'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
  'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
  'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
  'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore',
  'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo',
  'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen', 'Zambia', 'Zimbabwe',
]

// The few spellings that mean the same country as one already in the register.
// Only what is actually needed: the register says USA, and the ISO list says
// United States, and offering both would let somebody file the third US site
// into a country of its own.
const SAME_AS = {
  usa: ['united states', 'united states of america', 'us'],
  uk: ['united kingdom', 'great britain', 'gb'],
  uae: ['united arab emirates'],
}

const norm = (s) => String(s || '').trim().toLowerCase()

const aliasesOf = (name) => {
  const key = norm(name)
  if (SAME_AS[key]) return [key, ...SAME_AS[key]]
  for (const [k, list] of Object.entries(SAME_AS)) {
    if (list.includes(key)) return [k, ...list]
  }
  return [key]
}

/**
 * What the picker offers: the register's own countries first, then the rest.
 *
 * `extra` carries a country already on the record being edited, so opening a
 * site filed under something outside both lists does not silently blank the
 * field it is showing.
 */
export function countryOptions(extra = '') {
  const inRegister = [...new Set([...SITES.map((s) => s.country), extra].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))

  const taken = new Set(inRegister.flatMap(aliasesOf))
  const rest = COUNTRIES.filter((c) => !taken.has(norm(c)))

  return { inRegister, rest }
}
