// Client-safe flag utility - no server dependencies
export function getCountryFlagUrl(countryCode?: string | null): string {
  let code = (countryCode || 'US').toLowerCase().trim();
  if (code === 'uk') code = 'gb';
  if (code.length === 2 && code !== 'un') {
    return 'https://flagcdn.com/24x18/' + code + '.png';
  }
  return 'https://flagcdn.com/24x18/us.png';
}

