export interface Country {
  code: string;
  label: string;
}

/**
 * ISO 3166-1 alpha-2 country list.
 * Includes all EU member states + US, CA, UK, AU, JP, SG and common others.
 */
export const COUNTRIES: Country[] = [
  // EU member states
  { code: 'AT', label: 'Austria' },
  { code: 'BE', label: 'Belgium' },
  { code: 'BG', label: 'Bulgaria' },
  { code: 'HR', label: 'Croatia' },
  { code: 'CY', label: 'Cyprus' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'DK', label: 'Denmark' },
  { code: 'EE', label: 'Estonia' },
  { code: 'FI', label: 'Finland' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'GR', label: 'Greece' },
  { code: 'HU', label: 'Hungary' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IT', label: 'Italy' },
  { code: 'LV', label: 'Latvia' },
  { code: 'LT', label: 'Lithuania' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'MT', label: 'Malta' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'RO', label: 'Romania' },
  { code: 'SK', label: 'Slovakia' },
  { code: 'SI', label: 'Slovenia' },
  { code: 'ES', label: 'Spain' },
  { code: 'SE', label: 'Sweden' },
  // Key non-EU
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'JP', label: 'Japan' },
  { code: 'MX', label: 'Mexico' },
  { code: 'NO', label: 'Norway' },
  { code: 'SG', label: 'Singapore' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  // Common others
  { code: 'AR', label: 'Argentina' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CN', label: 'China' },
  { code: 'EG', label: 'Egypt' },
  { code: 'IN', label: 'India' },
  { code: 'ID', label: 'Indonesia' },
  { code: 'IL', label: 'Israel' },
  { code: 'KR', label: 'South Korea' },
  { code: 'TR', label: 'Turkey' },
  { code: 'UA', label: 'Ukraine' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'VN', label: 'Vietnam' },
  { code: 'ZA', label: 'South Africa' },
];
