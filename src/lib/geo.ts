export interface GeoInfo {
  country: string;
  countryCode: string;
  city: string;
  flagUrl: string;
}

export function getCountryFlagUrl(countryCode: string): string {
  const code = (countryCode || 'PK').toLowerCase().trim();
  if (code.length === 2) {
    return `https://flagcdn.com/24x18/${code}.png`;
  }
  return 'https://flagcdn.com/24x18/un.png';
}

export function parseReferrer(rawReferrer: string): { source: string; label: string; icon: string } {
  if (!rawReferrer || rawReferrer === '' || rawReferrer.includes('Direct') || rawReferrer.includes('direct')) {
    return { source: 'direct', label: 'Direct Entry / URL', icon: '🔗' };
  }
  if (rawReferrer.includes('google')) {
    return { source: 'google', label: 'Google Search', icon: '🔍' };
  }
  if (rawReferrer.includes('linkedin')) {
    return { source: 'linkedin', label: 'LinkedIn B2B', icon: '💼' };
  }
  if (rawReferrer.includes('facebook') || rawReferrer.includes('fb')) {
    return { source: 'facebook', label: 'Facebook Ads', icon: '📱' };
  }
  if (rawReferrer.includes('twitter') || rawReferrer.includes('x.com')) {
    return { source: 'twitter', label: 'X (Twitter)', icon: '🐦' };
  }
  try {
    const url = new URL(rawReferrer);
    return { source: 'referral', label: url.hostname, icon: '🌐' };
  } catch {
    return { source: 'referral', label: rawReferrer, icon: '🌐' };
  }
}

const countryNames: Record<string, string> = {
  'PK': 'Pakistan', 'US': 'United States', 'GB': 'United Kingdom',
  'IN': 'India', 'SA': 'Saudi Arabia', 'AE': 'UAE', 'CA': 'Canada',
  'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'TR': 'Turkey',
  'NG': 'Nigeria', 'EG': 'Egypt', 'BD': 'Bangladesh', 'MY': 'Malaysia',
  'SG': 'Singapore', 'NL': 'Netherlands', 'IT': 'Italy', 'ES': 'Spain',
  'BR': 'Brazil', 'ID': 'Indonesia', 'JP': 'Japan', 'KR': 'South Korea',
  'RU': 'Russia', 'MX': 'Mexico', 'ZA': 'South Africa', 'KE': 'Kenya',
  'CN': 'China', 'AF': 'Afghanistan', 'IR': 'Iran', 'IQ': 'Iraq',
  'JO': 'Jordan', 'KW': 'Kuwait', 'QA': 'Qatar', 'BH': 'Bahrain',
  'OM': 'Oman', 'YE': 'Yemen', 'LB': 'Lebanon', 'SY': 'Syria',
  'PH': 'Philippines', 'TH': 'Thailand', 'VN': 'Vietnam',
};

// Cache geo results to avoid repeated API calls for same IP
const geoCache = new Map<string, { country: string; countryCode: string; city: string; flag: string }>();

export async function lookupGeoAsync(ip: string): Promise<{ country: string; countryCode: string; city: string; flag: string }> {
  // Handle local/loopback IPs - default to Pakistan
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') || ip.startsWith('172.2') || ip.startsWith('172.3')) {
    return { country: 'Pakistan', countryCode: 'PK', city: 'Lahore', flag: getCountryFlagUrl('PK') };
  }

  // Check cache first
  if (geoCache.has(ip)) {
    return geoCache.get(ip)!;
  }

  try {
    // ip-api.com free tier: 1000 req/min, no key required
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName`, {
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.countryCode) {
        const countryCode = data.countryCode as string;
        const city = (data.city && data.city !== '') ? data.city : (data.regionName || 'Unknown');
        const country = countryNames[countryCode] || data.country || countryCode;
        const result = { country, countryCode, city, flag: getCountryFlagUrl(countryCode) };
        geoCache.set(ip, result);
        return result;
      }
    }
  } catch (e) {
    console.error('[GEO] ip-api.com lookup failed:', e);
  }

  // Fallback
  const fallback = { country: 'Unknown', countryCode: 'UN', city: 'Unknown', flag: getCountryFlagUrl('UN') };
  return fallback;
}

// Synchronous version (returns default, triggers async update) - kept for compatibility
export function lookupGeo(ip: string): { country: string; countryCode: string; city: string; flag: string } {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { country: 'Pakistan', countryCode: 'PK', city: 'Lahore', flag: getCountryFlagUrl('PK') };
  }
  if (geoCache.has(ip)) {
    return geoCache.get(ip)!;
  }
  // Return placeholder; caller should use lookupGeoAsync
  return { country: 'Loading...', countryCode: 'UN', city: 'Unknown', flag: getCountryFlagUrl('UN') };
}

