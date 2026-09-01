// Client-safe flag utility - no server dependencies
export function getCountryFlagUrl(countryCode: string): string {
  const code = (countryCode || 'PK').toLowerCase().trim();
  if (code.length === 2) {
    return 'https://flagcdn.com/24x18/' + code + '.png';
  }
  return 'https://flagcdn.com/24x18/un.png';
}
