/* ============================================================
   Bloomly Sticker Library
   ============================================================ */

const STICKER_SVGS = {
  heart: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <path d="M50 86 C25 65 12 50 12 33 C12 18 24 10 37 10 C44 10 50 15 50 15 C50 15 56 10 63 10 C76 10 88 18 88 33 C88 50 75 65 50 86 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
    <path d="M50 84 C27 64 14 49 14 33 C14 19 25 12 37 12 C44 12 49 16 50 17 C51 16 56 12 63 12 C75 12 86 19 86 33 C86 49 73 64 50 84 Z" fill="#FF6F91" stroke="#4A2C4F" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M26 24 C20 30 20 40 22 46" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="28" cy="20" r="2.5" fill="#FFFFFF"/>
    <circle cx="36" cy="42" r="3.5" fill="#FFB3C7"/>
    <circle cx="64" cy="42" r="3.5" fill="#FFB3C7"/>
    <circle cx="42" cy="38" r="2.5" fill="#4A2C4F"/>
    <circle cx="58" cy="38" r="2.5" fill="#4A2C4F"/>
    <path d="M47 42 Q50 46 53 42" fill="none" stroke="#4A2C4F" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  star: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <path d="M50 12 L59 36 L85 36 L64 52 L72 76 L50 61 L28 76 L36 52 L15 36 L41 36 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
    <path d="M50 14 L58 36 L83 36 L63 52 L70 74 L50 60 L30 74 L37 52 L17 36 L42 36 Z" fill="#FFF0B3" stroke="#4A2C4F" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="40" cy="48" r="3.5" fill="#FFCDB2"/>
    <circle cx="60" cy="48" r="3.5" fill="#FFCDB2"/>
    <circle cx="43" cy="44" r="2.5" fill="#4A2C4F"/>
    <circle cx="57" cy="44" r="2.5" fill="#4A2C4F"/>
    <path d="M47 48 Q50 52 53 48" fill="none" stroke="#4A2C4F" stroke-width="2" stroke-linecap="round"/>
    <circle cx="34" cy="30" r="2.5" fill="#FFFFFF"/>
  </svg>`,

  sparkle: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <path d="M50 10 Q50 45 15 50 Q50 55 50 90 Q50 55 85 50 Q50 45 50 10 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
    <path d="M50 12 Q50 45 17 50 Q50 55 50 88 Q50 55 83 50 Q50 45 50 12 Z" fill="#D9C8FF" stroke="#4A2C4F" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="7" fill="#FFFFFF"/>
    <circle cx="78" cy="22" r="5" fill="#FFFFFF" stroke="#4A2C4F" stroke-width="2"/>
    <circle cx="78" cy="22" r="3.5" fill="#CDEFE2"/>
    <circle cx="22" cy="78" r="4" fill="#FFFFFF" stroke="#4A2C4F" stroke-width="2"/>
    <circle cx="22" cy="78" r="2.5" fill="#FFF0B3"/>
  </svg>`,

  flower: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <circle cx="50" cy="50" r="42" fill="#FFFFFF"/>
    <circle cx="50" cy="22" r="14" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="74" cy="34" r="14" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="74" cy="66" r="14" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="50" cy="78" r="14" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="26" cy="66" r="14" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="26" cy="34" r="14" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="50" cy="50" r="20" fill="#FFF0B3" stroke="#4A2C4F" stroke-width="3.5"/>
    <circle cx="43" cy="48" r="2.5" fill="#4A2C4F"/>
    <circle cx="57" cy="48" r="2.5" fill="#4A2C4F"/>
    <circle cx="39" cy="53" r="3" fill="#FFCDB2"/>
    <circle cx="61" cy="53" r="3" fill="#FFCDB2"/>
    <path d="M47 52 Q50 56 53 52" fill="none" stroke="#4A2C4F" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  cloud: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <path d="M30 68 C20 68 12 60 12 50 C12 41 18 34 26 33 C28 22 38 14 50 14 C62 14 72 22 74 33 C82 34 88 41 88 50 C88 60 80 68 70 68 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
    <path d="M30 68 C20 68 12 60 12 50 C12 41 18 34 26 33 C28 22 38 14 50 14 C62 14 72 22 74 33 C82 34 88 41 88 50 C88 60 80 68 70 68 Z" fill="#FFFFFF" stroke="#4A2C4F" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M39 44 Q43 40 47 44" fill="none" stroke="#4A2C4F" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M53 44 Q57 40 61 44" fill="none" stroke="#4A2C4F" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="36" cy="49" r="4" fill="#FFB3C7"/>
    <circle cx="64" cy="49" r="4" fill="#FFB3C7"/>
    <path d="M47 50 Q50 54 53 50" fill="none" stroke="#4A2C4F" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  moon: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <path d="M60 12 C35 12 18 30 18 52 C18 74 35 90 58 90 C70 90 80 84 86 76 C65 74 50 58 50 38 C50 26 56 16 64 12 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
    <path d="M60 14 C36 14 20 31 20 52 C20 73 36 88 58 88 C69 88 78 83 83 75 C64 72 50 57 50 38 C50 27 55 18 63 14 Z" fill="#FFF0B3" stroke="#4A2C4F" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M34 50 Q39 46 44 50" fill="none" stroke="#4A2C4F" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="36" cy="56" r="3.5" fill="#FFCDB2"/>
    <circle cx="28" cy="38" r="2" fill="#FFFFFF"/>
    <path d="M72 32 L74 38 L80 38 L75 42 L77 48 L72 44 L67 48 L69 42 L64 38 L70 38 Z" fill="#D9C8FF" stroke="#4A2C4F" stroke-width="2"/>
  </svg>`,

  smiley_blob: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <path d="M50 16 C75 16 88 32 88 56 C88 78 72 86 50 86 C26 86 12 78 12 56 C12 32 25 16 50 16 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
    <path d="M50 18 C73 18 86 34 86 56 C86 76 70 84 50 84 C28 84 14 76 14 56 C14 34 27 18 50 18 Z" fill="#FFCDB2" stroke="#4A2C4F" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="34" cy="56" r="4.5" fill="#FFB3C7"/>
    <circle cx="66" cy="56" r="4.5" fill="#FFB3C7"/>
    <circle cx="39" cy="48" r="3" fill="#4A2C4F"/>
    <circle cx="61" cy="48" r="3" fill="#4A2C4F"/>
    <path d="M44 54 Q50 62 56 54" fill="none" stroke="#4A2C4F" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M50 18 Q50 8 44 8 Q50 8 50 18" fill="#CDEFE2" stroke="#4A2C4F" stroke-width="2.5"/>
  </svg>`,

  butterfly: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <ellipse cx="50" cy="52" rx="42" ry="34" fill="#FFFFFF"/>
    <path d="M50 48 C42 22 16 22 18 46 C20 60 48 52 50 52 Z" fill="#D9C8FF" stroke="#4A2C4F" stroke-width="3"/>
    <path d="M50 48 C58 22 84 22 82 46 C80 60 52 52 50 52 Z" fill="#D9C8FF" stroke="#4A2C4F" stroke-width="3"/>
    <path d="M50 52 C44 54 26 56 28 72 C30 84 48 68 50 58 Z" fill="#FFCDB2" stroke="#4A2C4F" stroke-width="3"/>
    <path d="M50 52 C56 54 74 56 72 72 C70 84 52 68 50 58 Z" fill="#FFCDB2" stroke="#4A2C4F" stroke-width="3"/>
    <path d="M47 38 Q42 24 36 28" fill="none" stroke="#4A2C4F" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M53 38 Q58 24 64 28" fill="none" stroke="#4A2C4F" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="36" cy="28" r="2" fill="#FF6F91"/>
    <circle cx="64" cy="28" r="2" fill="#FF6F91"/>
    <rect x="46" y="36" width="8" height="32" rx="4" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="2.5"/>
  </svg>`,

  bow: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <ellipse cx="50" cy="50" rx="42" ry="32" fill="#FFFFFF"/>
    <path d="M50 48 C36 30 14 36 16 52 C18 68 38 62 50 54 Z" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3"/>
    <path d="M50 48 C64 30 86 36 84 52 C82 68 62 62 50 54 Z" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3"/>
    <path d="M46 54 L32 82 L42 78 L50 60 Z" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M54 54 L68 82 L58 78 L50 60 Z" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="43" y="44" width="14" height="14" rx="5" fill="#FF6F91" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="47" cy="48" r="1.5" fill="#FFFFFF"/>
  </svg>`,

  cherry: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <ellipse cx="50" cy="54" rx="42" ry="38" fill="#FFFFFF"/>
    <path d="M50 20 C46 36 34 50 34 56" fill="none" stroke="#4A2C4F" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 20 C54 36 66 50 66 56" fill="none" stroke="#4A2C4F" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 20 C62 14 74 22 66 32 C58 34 52 26 50 20 Z" fill="#CDEFE2" stroke="#4A2C4F" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="34" cy="64" r="18" fill="#FF6F91" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="28" cy="58" r="3" fill="#FFFFFF"/>
    <circle cx="29" cy="68" r="2.5" fill="#FFB3C7"/>
    <circle cx="39" cy="68" r="2.5" fill="#FFB3C7"/>
    <circle cx="66" cy="66" r="18" fill="#FF6F91" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="60" cy="60" r="3" fill="#FFFFFF"/>
    <circle cx="61" cy="70" r="2.5" fill="#FFB3C7"/>
    <circle cx="71" cy="70" r="2.5" fill="#FFB3C7"/>
  </svg>`,

  plant: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <path d="M28 50 L34 84 C35 88 40 90 50 90 C60 90 65 88 66 84 L72 50 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>
    <path d="M50 50 C44 32 30 26 34 16 C46 18 48 38 50 50 Z" fill="#CDEFE2" stroke="#4A2C4F" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 50 C56 32 70 26 66 16 C54 18 52 38 50 50 Z" fill="#CDEFE2" stroke="#4A2C4F" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 50 C46 36 50 20 50 14 C54 20 54 36 50 50 Z" fill="#FFCDB2" stroke="#4A2C4F" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="24" y="48" width="52" height="10" rx="5" fill="#FFCDB2" stroke="#4A2C4F" stroke-width="3"/>
    <path d="M28 58 L34 82 C35 85 40 88 50 88 C60 88 65 85 66 82 L72 58 Z" fill="#FFB3C7" stroke="#4A2C4F" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="43" cy="70" r="2.5" fill="#4A2C4F"/>
    <circle cx="57" cy="70" r="2.5" fill="#4A2C4F"/>
    <circle cx="39" cy="74" r="2.5" fill="#FF6F91"/>
    <circle cx="61" cy="74" r="2.5" fill="#FF6F91"/>
    <path d="M48 74 Q50 77 52 74" fill="none" stroke="#4A2C4F" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  sprout: `<svg viewBox="0 0 100 100" class="sticker-svg" aria-hidden="true">
    <ellipse cx="50" cy="54" rx="38" ry="34" fill="#FFFFFF"/>
    <path d="M50 78 C50 62 50 48 50 36" fill="none" stroke="#4A2C4F" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M50 44 C34 44 26 34 30 24 C44 22 48 38 50 44 Z" fill="#CDEFE2" stroke="#4A2C4F" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 38 C66 38 74 28 70 18 C56 16 52 32 50 38 Z" fill="#CDEFE2" stroke="#4A2C4F" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="62" cy="24" r="2.5" fill="#FFFFFF"/>
    <ellipse cx="50" cy="80" rx="26" ry="8" fill="#FFCDB2" stroke="#4A2C4F" stroke-width="3"/>
    <circle cx="44" cy="79" r="1.5" fill="#4A2C4F"/>
    <circle cx="56" cy="79" r="1.5" fill="#4A2C4F"/>
    <path d="M48 81 Q50 83 52 81" fill="none" stroke="#4A2C4F" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
};

const NORMALIZE_MAP = {
  'smiley blob': 'smiley_blob',
  'smiley-blob': 'smiley_blob',
  'tiny house plant': 'plant',
  'tiny-house-plant': 'plant',
  'tiny plant': 'plant',
  'house_plant': 'plant'
};

const STICKER_NAMES = [
  'heart',
  'star',
  'sparkle',
  'flower',
  'cloud',
  'moon',
  'smiley_blob',
  'butterfly',
  'bow',
  'cherry',
  'plant',
  'sprout'
];

function normalizeStickerName(name) {
  if (!name || typeof name !== 'string') return 'flower';
  const clean = name.trim().toLowerCase();
  if (NORMALIZE_MAP[clean]) return NORMALIZE_MAP[clean];
  if (STICKER_SVGS[clean]) return clean;
  return 'flower';
}

function getStickerSvg(name, options = {}) {
  const normalized = normalizeStickerName(name);
  const rawSvg = STICKER_SVGS[normalized] || STICKER_SVGS.flower;
  const { className = '', size = null } = options;

  if (!className && !size) return rawSvg;

  let styled = rawSvg;
  if (className) {
    styled = styled.replace('class="sticker-svg"', `class="sticker-svg ${className}"`);
  }
  if (size) {
    styled = styled.replace('<svg ', `<svg width="${size}" height="${size}" `);
  }
  return styled;
}

function getAllStickers() {
  return STICKER_NAMES.map((key) => ({
    name: key,
    label: key.replace('_', ' '),
    svg: STICKER_SVGS[key]
  }));
}

if (typeof window !== 'undefined') {
  window.BloomlyStickers = {
    STICKER_NAMES,
    getStickerSvg,
    getAllStickers,
    normalizeStickerName
  };
}

export {
  STICKER_NAMES,
  getStickerSvg,
  getAllStickers,
  normalizeStickerName
};

