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

  if (typeof media === 'string') {
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `/api/media/${encodeURIComponent(media)}/file?variant=${encodeURIComponent(variant)}${tokenParam}`;
  }

  const isVideo = media.type === 'video';

  // If this media item already has structured URLs (from API formatters or demo manifest)
  if (media.urls && typeof media.urls === 'object') {
    if (variant === 'thumb' && media.urls.thumb) return media.urls.thumb;
    if (variant === 'display' && media.urls.display) return media.urls.display;
    if (variant === 'poster' && media.urls.poster) return media.urls.poster;
    if (variant === 'video' && media.urls.video) return media.urls.video;
    if (variant === 'original' && media.urls.original) return media.urls.original;

    if (isVideo && (variant === 'thumb' || variant === 'display') && media.urls.poster) {
      return media.urls.poster;
    }
    if (variant === 'thumb' && media.urls.display) return media.urls.display;
    if (variant === 'display' && media.urls.thumb) return media.urls.thumb;
  }

  const id = media.id || media._id;
  if (!id) return '';

  const effectiveVariant = isVideo && (variant === 'thumb' || variant === 'display') ? 'poster' : variant;
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  return `/api/media/${encodeURIComponent(id)}/file?variant=${encodeURIComponent(effectiveVariant)}${tokenParam}`;
}

