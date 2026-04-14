export interface MarketplaceOption {
  value: string;
  label: string;
  flag: string;
  domain: string;
}

export const MARKETPLACE_OPTIONS: MarketplaceOption[] = [
  { value: 'amazon_com', label: 'Amazon.com', flag: '\u{1F1FA}\u{1F1F8}', domain: 'amazon.com' },
  { value: 'amazon_co_uk', label: 'Amazon.co.uk', flag: '\u{1F1EC}\u{1F1E7}', domain: 'amazon.co.uk' },
  { value: 'amazon_de', label: 'Amazon.de', flag: '\u{1F1E9}\u{1F1EA}', domain: 'amazon.de' },
  { value: 'amazon_fr', label: 'Amazon.fr', flag: '\u{1F1EB}\u{1F1F7}', domain: 'amazon.fr' },
  { value: 'amazon_it', label: 'Amazon.it', flag: '\u{1F1EE}\u{1F1F9}', domain: 'amazon.it' },
  { value: 'amazon_es', label: 'Amazon.es', flag: '\u{1F1EA}\u{1F1F8}', domain: 'amazon.es' },
];
