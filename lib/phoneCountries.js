// Phone country codes, shared by the public booking form and the studio's client editor.

export function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith('Australia/'))             return 'AU';
    if (tz.startsWith('Pacific/Auckland') || tz === 'Pacific/Chatham') return 'NZ';
    const map = {
      'Europe/London': 'GB',    'Europe/Paris': 'FR',     'Europe/Berlin': 'DE',
      'Europe/Vienna': 'AT',    'Europe/Brussels': 'BE',  'Europe/Athens': 'GR',
      'Europe/Dublin': 'IE',    'Europe/Rome': 'IT',      'Europe/Amsterdam': 'NL',
      'Europe/Oslo': 'NO',      'Europe/Warsaw': 'PL',    'Europe/Lisbon': 'PT',
      'Europe/Moscow': 'RU',    'Europe/Madrid': 'ES',    'Europe/Stockholm': 'SE',
      'Europe/Zurich': 'CH',    'Europe/Istanbul': 'TR',  'Europe/Helsinki': 'FI',
      'Europe/Copenhagen': 'DK',
      'Asia/Tokyo': 'JP',       'Asia/Seoul': 'KR',       'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',   'Asia/Singapore': 'SG',   'Asia/Taipei': 'TW',
      'Asia/Bangkok': 'TH',     'Asia/Jakarta': 'ID',     'Asia/Kolkata': 'IN',
      'Asia/Kuala_Lumpur': 'MY','Asia/Manila': 'PH',      'Asia/Riyadh': 'SA',
      'Asia/Dubai': 'AE',       'Asia/Jerusalem': 'IL',
      'America/Sao_Paulo': 'BR','America/Mexico_City': 'MX',
      'America/Toronto': 'CA',  'America/Vancouver': 'CA','America/Winnipeg': 'CA',
      'America/Edmonton': 'CA', 'America/Halifax': 'CA',  'America/St_Johns': 'CA',
      'Africa/Johannesburg': 'ZA',
    };
    if (map[tz]) return map[tz];
    if (tz.startsWith('America/')) return 'US';
  } catch {}
  return 'US';
}

export const COUNTRIES = [
  { id: 'AU', flag: '🇦🇺', name: 'Australia',      dial: '+61'  },
  { id: 'AT', flag: '🇦🇹', name: 'Austria',        dial: '+43'  },
  { id: 'BE', flag: '🇧🇪', name: 'Belgium',        dial: '+32'  },
  { id: 'BR', flag: '🇧🇷', name: 'Brazil',         dial: '+55'  },
  { id: 'CA', flag: '🇨🇦', name: 'Canada',         dial: '+1'   },
  { id: 'CN', flag: '🇨🇳', name: 'China',          dial: '+86'  },
  { id: 'DK', flag: '🇩🇰', name: 'Denmark',        dial: '+45'  },
  { id: 'FI', flag: '🇫🇮', name: 'Finland',        dial: '+358' },
  { id: 'FR', flag: '🇫🇷', name: 'France',         dial: '+33'  },
  { id: 'DE', flag: '🇩🇪', name: 'Germany',        dial: '+49'  },
  { id: 'GR', flag: '🇬🇷', name: 'Greece',         dial: '+30'  },
  { id: 'HK', flag: '🇭🇰', name: 'Hong Kong',      dial: '+852' },
  { id: 'IN', flag: '🇮🇳', name: 'India',          dial: '+91'  },
  { id: 'ID', flag: '🇮🇩', name: 'Indonesia',      dial: '+62'  },
  { id: 'IE', flag: '🇮🇪', name: 'Ireland',        dial: '+353' },
  { id: 'IL', flag: '🇮🇱', name: 'Israel',         dial: '+972' },
  { id: 'IT', flag: '🇮🇹', name: 'Italy',          dial: '+39'  },
  { id: 'JP', flag: '🇯🇵', name: 'Japan',          dial: '+81'  },
  { id: 'KR', flag: '🇰🇷', name: 'South Korea',    dial: '+82'  },
  { id: 'MY', flag: '🇲🇾', name: 'Malaysia',       dial: '+60'  },
  { id: 'MX', flag: '🇲🇽', name: 'Mexico',         dial: '+52'  },
  { id: 'NL', flag: '🇳🇱', name: 'Netherlands',    dial: '+31'  },
  { id: 'NZ', flag: '🇳🇿', name: 'New Zealand',    dial: '+64'  },
  { id: 'NO', flag: '🇳🇴', name: 'Norway',         dial: '+47'  },
  { id: 'PH', flag: '🇵🇭', name: 'Philippines',    dial: '+63'  },
  { id: 'PL', flag: '🇵🇱', name: 'Poland',         dial: '+48'  },
  { id: 'PT', flag: '🇵🇹', name: 'Portugal',       dial: '+351' },
  { id: 'RU', flag: '🇷🇺', name: 'Russia',         dial: '+7'   },
  { id: 'SA', flag: '🇸🇦', name: 'Saudi Arabia',   dial: '+966' },
  { id: 'SG', flag: '🇸🇬', name: 'Singapore',      dial: '+65'  },
  { id: 'ZA', flag: '🇿🇦', name: 'South Africa',   dial: '+27'  },
  { id: 'ES', flag: '🇪🇸', name: 'Spain',          dial: '+34'  },
  { id: 'SE', flag: '🇸🇪', name: 'Sweden',         dial: '+46'  },
  { id: 'CH', flag: '🇨🇭', name: 'Switzerland',    dial: '+41'  },
  { id: 'TW', flag: '🇹🇼', name: 'Taiwan',         dial: '+886' },
  { id: 'TH', flag: '🇹🇭', name: 'Thailand',       dial: '+66'  },
  { id: 'TR', flag: '🇹🇷', name: 'Turkey',         dial: '+90'  },
  { id: 'AE', flag: '🇦🇪', name: 'UAE',            dial: '+971' },
  { id: 'GB', flag: '🇬🇧', name: 'United Kingdom', dial: '+44'  },
  { id: 'US', flag: '🇺🇸', name: 'United States',  dial: '+1'   },
  { id: 'VN', flag: '🇻🇳', name: 'Vietnam',        dial: '+84'  },
];

// "+61401863530" → { country: 'AU', number: '401863530' }. Numbers without a known code
// keep the studio's guess for the country and the whole number.
export function splitPhone(phone, fallback = detectCountry()) {
  const raw = String(phone ?? '').trim();
  const country = raw.startsWith('+') ? [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find(c => raw.startsWith(c.dial)) : null;
  return country ? { country: country.id, number: raw.slice(country.dial.length).trim() } : { country: fallback, number: raw };
}

// Country + local number → "+61401863530" (a leading 0 on the local number is dropped).
export function joinPhone(countryId, number) {
  const digits = String(number ?? '').replace(/[^0-9]/g, '').replace(/^0+/, '');
  if (!digits) return '';
  const dial = COUNTRIES.find(c => c.id === countryId)?.dial ?? '';
  return `${dial}${digits}`;
}
