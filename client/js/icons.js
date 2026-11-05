// Keepsake Icons & Stickers Module

const ICONS = {
  home: '<path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z"/><polyline points="9 21.5 9 12 15 12 15 21.5"/>',
  library: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"/><line x1="8" y1="2" x2="8" y2="22"/><line x1="16" y1="2" x2="16" y2="22"/>',
  album: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  'heart-filled': '<path fill="currentColor" stroke="none" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
  comment: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  'chevron-up': '<polyline points="18 15 12 9 6 15"/>',
  'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  collage: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="12" y1="12" x2="21" y2="12"/>',
  carousel: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="19.5" r="1"/><circle cx="12" cy="19.5" r="1"/><circle cx="16" cy="19.5" r="1"/>',
  'zoom-in': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
  'zoom-out': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>',
  fullscreen: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><polyline points="21 15 21 21 15 21"/><polyline points="3 9 3 3 9 3"/>',
  more: '<circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  sort: '<path d="M11 5h10M11 9h7M11 13h4"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4"/>',
  'drag-handle': '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'
};

const STICKERS = {
  camera: '<rect x="8" y="16" width="48" height="36" rx="6" fill="var(--color-sand)" stroke="var(--color-ink)" stroke-width="2.5"/><path d="M22 16l3-6h14l3 6" fill="var(--color-sand)" stroke="var(--color-ink)" stroke-width="2.5"/><circle cx="32" cy="34" r="12" fill="var(--color-terracotta)" stroke="var(--color-ink)" stroke-width="2.5"/><circle cx="32" cy="34" r="6" fill="var(--color-teal)"/><circle cx="48" cy="22" r="3" fill="var(--color-mustard)"/>',
  'film-roll': '<rect x="14" y="12" width="36" height="40" rx="4" fill="var(--color-ink)"/><path d="M50 20h8v24h-8z" fill="var(--color-mustard)" stroke="var(--color-ink)" stroke-width="2"/><circle cx="32" cy="32" r="8" fill="var(--color-sand)"/><line x1="14" y1="20" x2="50" y2="20" stroke="var(--color-sand)" stroke-width="2" stroke-dasharray="3 3"/><line x1="14" y1="44" x2="50" y2="44" stroke="var(--color-sand)" stroke-width="2" stroke-dasharray="3 3"/>',
  polaroid: '<rect x="12" y="8" width="40" height="48" rx="3" fill="var(--color-white)" stroke="var(--color-ink)" stroke-width="2.5"/><rect x="17" y="13" width="30" height="26" fill="var(--color-slate)"/><circle cx="23" cy="20" r="3" fill="var(--color-mustard)"/><path d="M17 35l10-10 7 7 6-5 7 7v5H17z" fill="var(--color-sage)"/><rect x="20" y="45" width="24" height="4" rx="2" fill="var(--color-sand)"/>',
  mountain: '<circle cx="32" cy="32" r="26" fill="var(--color-sand)"/><path d="M10 50l18-26 10 14 6-8 10 20z" fill="var(--color-teal)" stroke="var(--color-ink)" stroke-width="2"/><path d="M28 24l4 6-4 4-5-3z" fill="var(--color-white)"/><circle cx="46" cy="20" r="5" fill="var(--color-mustard)"/>',
  sun: '<circle cx="32" cy="32" r="14" fill="var(--color-mustard)" stroke="var(--color-ink)" stroke-width="2.5"/><line x1="32" y1="6" x2="32" y2="12" stroke="var(--color-terracotta)" stroke-width="3" stroke-linecap="round"/><line x1="32" y1="52" x2="32" y2="58" stroke="var(--color-terracotta)" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="32" x2="12" y2="32" stroke="var(--color-terracotta)" stroke-width="3" stroke-linecap="round"/><line x1="52" y1="32" x2="58" y2="32" stroke="var(--color-terracotta)" stroke-width="3" stroke-linecap="round"/><line x1="14" y1="14" x2="18" y2="18" stroke="var(--color-terracotta)" stroke-width="3" stroke-linecap="round"/><line x1="46" y1="46" x2="50" y2="50" stroke="var(--color-terracotta)" stroke-width="3" stroke-linecap="round"/><line x1="14" y1="50" x2="18" y2="46" stroke="var(--color-terracotta)" stroke-width="3" stroke-linecap="round"/><line x1="46" y1="18" x2="50" y2="14" stroke="var(--color-terracotta)" stroke-width="3" stroke-linecap="round"/>',
  compass: '<circle cx="32" cy="32" r="24" fill="var(--color-white)" stroke="var(--color-ink)" stroke-width="2.5"/><circle cx="32" cy="32" r="20" fill="none" stroke="var(--color-sand)" stroke-width="1.5"/><polygon points="32 14 37 32 32 30" fill="var(--color-terracotta)"/><polygon points="32 50 27 32 32 30" fill="var(--color-teal)"/><polygon points="32 14 27 32 32 30" fill="var(--color-mustard)"/><polygon points="32 50 37 32 32 30" fill="var(--color-stone)"/><circle cx="32" cy="32" r="2.5" fill="var(--color-ink)"/>',
  ticket: '<path d="M10 18h44v8a6 6 0 0 1 0 12v8H10v-8a6 6 0 0 1 0-12z" fill="var(--color-sand)" stroke="var(--color-ink)" stroke-width="2.5"/><line x1="26" y1="18" x2="26" y2="46" stroke="var(--color-terracotta)" stroke-width="2" stroke-dasharray="3 3"/><circle cx="18" cy="32" r="3" fill="var(--color-teal)"/><line x1="32" y1="26" x2="48" y2="26" stroke="var(--color-ink)" stroke-width="2" stroke-linecap="round"/><line x1="32" y1="34" x2="44" y2="34" stroke="var(--color-stone)" stroke-width="2" stroke-linecap="round"/>',
  pin: '<circle cx="32" cy="22" r="14" fill="var(--color-terracotta)" stroke="var(--color-ink)" stroke-width="2.5"/><circle cx="32" cy="22" r="5" fill="var(--color-white)"/><line x1="32" y1="36" x2="32" y2="56" stroke="var(--color-ink)" stroke-width="3" stroke-linecap="round"/>',
  balloon: '<ellipse cx="32" cy="24" rx="16" ry="18" fill="var(--color-slate)" stroke="var(--color-ink)" stroke-width="2.5"/><polygon points="32 42 29 46 35 46" fill="var(--color-slate)" stroke="var(--color-ink)" stroke-width="1.5"/><path d="M32 46c-2 6 4 10 0 14" fill="none" stroke="var(--color-ink)" stroke-width="2" stroke-linecap="round"/><ellipse cx="27" cy="18" rx="3" ry="5" fill="var(--color-white)" opacity="0.5"/>',
  cassette: '<rect x="8" y="16" width="48" height="32" rx="4" fill="var(--color-sand)" stroke="var(--color-ink)" stroke-width="2.5"/><rect x="14" y="22" width="36" height="18" rx="2" fill="var(--color-white)" stroke="var(--color-ink)" stroke-width="1.5"/><circle cx="23" cy="31" r="5" fill="var(--color-teal)"/><circle cx="41" cy="31" r="5" fill="var(--color-teal)"/><rect x="23" y="28" width="18" height="6" fill="var(--color-sand)"/>',
  star: '<polygon points="32 6 39 23 58 24 43 36 48 54 32 43 16 54 21 36 6 24 25 23" fill="var(--color-mustard)" stroke="var(--color-ink)" stroke-width="2.5" stroke-linejoin="round"/><polygon points="32 14 36 25 48 26 39 34 42 46 32 39 22 46 25 34 16 26 28 25" fill="var(--color-white)" opacity="0.3"/>',
  bookmark: '<path d="M18 8h28v48l-14-10-14 10z" fill="var(--color-teal)" stroke="var(--color-ink)" stroke-width="2.5"/><circle cx="32" cy="22" r="5" fill="var(--color-mustard)"/><line x1="26" y1="32" x2="38" y2="32" stroke="var(--color-white)" stroke-width="2" stroke-linecap="round"/>'
};

/**
 * Returns an inline SVG element for the requested icon.
 * @param {string} name 
 * @param {object} [options]
 * @param {number} [options.size=24]
 * @param {string} [options.className='']
 * @param {string} [options.ariaLabel]
 * @param {boolean} [options.ariaHidden=true]
 * @returns {SVGElement}
 */
export function icon(name, options = {}) {
  const inner = ICONS[name];
  if (!inner) {
    console.warn(`Icon "${name}" not found`);
    return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  }

  const size = options.size || 24;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (options.className) {
    svg.setAttribute('class', options.className);
  }

  if (options.ariaLabel) {
    svg.setAttribute('aria-label', options.ariaLabel);
    svg.setAttribute('role', 'img');
  } else if (options.ariaHidden !== false) {
    svg.setAttribute('aria-hidden', 'true');
  }

  svg.innerHTML = inner;
  return svg;
}

/**
 * Returns an inline SVG element for the requested sticker.
 * @param {string} name 
 * @param {object} [options]
 * @param {number} [options.size=64]
 * @param {string} [options.className='']
 * @param {string} [options.ariaLabel]
 * @returns {SVGElement}
 */
export function sticker(name, options = {}) {
  const inner = STICKERS[name];
  if (!inner) {
    console.warn(`Sticker "${name}" not found`);
    return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  }

  const size = options.size || 64;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  if (options.className) {
    svg.setAttribute('class', options.className);
  }

  if (options.ariaLabel) {
    svg.setAttribute('aria-label', options.ariaLabel);
    svg.setAttribute('role', 'img');
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }

  svg.innerHTML = inner;
  return svg;
}

export const availableIcons = Object.keys(ICONS);
export const availableStickers = Object.keys(STICKERS);
