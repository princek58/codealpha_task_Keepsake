// Keepsake Media URL Helper Module

/**
 * Builds the URL to access a media variant, appending share token if provided.
 * @param {object|string} media - Media object or media ID string
 * @param {string} [variant='display'] - 'thumb' | 'display' | 'video' | 'poster' | 'original'
 * @param {string|null} [token=null] - Optional album share token
 * @returns {string} The formatted media file URL
 */
export function getMediaUrl(media, variant = 'display', token = null) {
  if (!media) return '';

  const id = typeof media === 'string' ? media : (media.id || media._id);
  if (!id) return '';

  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  return `/api/media/${encodeURIComponent(id)}/file?variant=${encodeURIComponent(variant)}${tokenParam}`;
}

