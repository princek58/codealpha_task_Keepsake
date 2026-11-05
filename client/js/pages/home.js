// Keepsake Home Page & Chronological Feed Controller
import { requireAuth } from '../guard.js';
import { mountAppShell, renderWelcomeCard } from '../shell.js';
import { getFeed, getOnThisDay, toggleLikeMoment, deleteMoment, getSuggestions, followUser } from '../api.js';
import { renderLayout } from '../collage.js';
import { openLightbox } from '../lightbox.js';
import { mountStorageBar } from '../upload-manager.js';
import { icon } from '../icons.js';
import { showToast, showConfirmDialog, buildAvatar, formatTimeAgo, formatDate } from '../ui.js';
import { animateLikePop } from '../animations.js';

let currentUser = null;
let feedPage = 1;
let feedHasMore = false;
let feedLoading = false;
let feedObserver = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentUser = await requireAuth();
  } catch {
    return; // Guard handles redirection
  }

  mountAppShell({ activeTab: 'home', user: currentUser, pageTitle: 'Home' });

  initGreeting();
  renderWelcomeCard(document.getElementById('welcome-mount'));
  initStorageBar();
  initSuggestions();
  loadOnThisDay();
  initFeed();
});

function initGreeting() {
  const greetingEl = document.getElementById('greeting-title');
  if (!greetingEl || !currentUser) return;

  const hour = new Date().getHours();
  let timeStr = 'Good morning';
  if (hour >= 12 && hour < 18) timeStr = 'Good afternoon';
  else if (hour >= 18) timeStr = 'Good evening';

  const name = currentUser.displayName || currentUser.username;
  greetingEl.textContent = `${timeStr}, ${name}`;
}

function initStorageBar() {
  const mount = document.getElementById('sidebar-storage-mount');
  if (mount) {
    mountStorageBar(mount);
  }
}

async function initSuggestions() {
  const listEl = document.getElementById('suggestions-list');
  const cardEl = document.getElementById('sidebar-suggestions-card');
  if (!listEl) return;

  try {
    const res = await getSuggestions();
    const items = res.items || [];
    listEl.innerHTML = '';

    if (items.length === 0) {
      if (cardEl) cardEl.style.display = 'none';
      return;
    }

    items.slice(0, 5).forEach((u) => {
      const row = document.createElement('div');
      row.className = 'user-row';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '6px 0';

      const userLink = document.createElement('a');
      userLink.href = `/profile.html?u=${encodeURIComponent(u.username)}`;
      userLink.style.display = 'flex';
      userLink.style.alignItems = 'center';
      userLink.style.gap = 'var(--space-xs)';
      userLink.style.textDecoration = 'none';
      userLink.style.color = 'var(--color-ink)';
      userLink.style.overflow = 'hidden';

      const av = buildAvatar(u, 'sm');
      userLink.appendChild(av);

      const textWrap = document.createElement('div');
      textWrap.style.overflow = 'hidden';

      const dName = document.createElement('div');
      dName.style.fontSize = 'var(--text-xs)';
      dName.style.fontWeight = '600';
      dName.textContent = u.displayName || u.username;
      textWrap.appendChild(dName);

      const uName = document.createElement('div');
      uName.style.fontSize = '11px';
      uName.style.color = 'var(--color-stone)';
      uName.textContent = `@${u.username}`;
      textWrap.appendChild(uName);

      userLink.appendChild(textWrap);
      row.appendChild(userLink);

      // Follow Button
      const followBtn = document.createElement('button');
      followBtn.className = 'btn btn-sand btn-sm';
      followBtn.style.padding = '4px 10px';
      followBtn.style.fontSize = 'var(--text-xs)';
      followBtn.textContent = u.isFollowing ? 'Following' : 'Follow';
      if (u.isFollowing) followBtn.classList.add('btn-ghost');

      followBtn.onclick = async () => {
        const prev = u.isFollowing;
        u.isFollowing = !prev;
        followBtn.textContent = u.isFollowing ? 'Following' : 'Follow';
        followBtn.classList.toggle('btn-ghost', u.isFollowing);

        try {
          const update = await followUser(u.id || u._id);
          u.isFollowing = update.following;
          followBtn.textContent = update.following ? 'Following' : 'Follow';
          followBtn.classList.toggle('btn-ghost', update.following);
        } catch (err) {
          u.isFollowing = prev;
          followBtn.textContent = prev ? 'Following' : 'Follow';
          followBtn.classList.toggle('btn-ghost', prev);
          showToast('Failed to update follow status: ' + err.message, 'error');
        }
      };

      row.appendChild(followBtn);
      listEl.appendChild(row);
    });
  } catch {
    if (cardEl) cardEl.style.display = 'none';
  }
}

async function loadOnThisDay() {
  const section = document.getElementById('on-this-day-section');
  const strip = document.getElementById('otd-strip');
  if (!section || !strip) return;

  try {
    const res = await getOnThisDay();
    const groups = res.groups || [];
    if (groups.length === 0) {
      section.style.display = 'none';
      return;
    }

    strip.innerHTML = '';
    let totalItems = 0;

    groups.forEach((group) => {
      const yearDiff = new Date().getFullYear() - group.year;
      const yearLabel = yearDiff === 1 ? '1 year ago' : `${yearDiff} years ago`;

      // Moments in this year
      (group.moments || []).forEach((m) => {
        totalItems++;
        const tile = document.createElement('div');
        tile.className = 'otd-item-tile';

        const coverMedia = m.media?.[0];
        const thumbUrl = coverMedia?.urls?.thumb || coverMedia?.urls?.display || '/assets/demo/demo-1.webp';

        const imgWrap = document.createElement('div');
        imgWrap.style.position = 'relative';
        imgWrap.style.aspectRatio = '1/1';
        imgWrap.style.borderRadius = 'var(--radius-sm)';
        imgWrap.style.overflow = 'hidden';
        imgWrap.style.marginBottom = '6px';
        imgWrap.style.backgroundColor = 'var(--color-sand)';

        const img = document.createElement('img');
        img.src = thumbUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.alt = m.title || 'Memory';
        imgWrap.appendChild(img);

        const badge = document.createElement('span');
        badge.className = 'badge badge-terracotta';
        badge.style.position = 'absolute';
        badge.style.bottom = '6px';
        badge.style.left = '6px';
        badge.style.fontSize = '10px';
        badge.textContent = yearLabel;
        imgWrap.appendChild(badge);
        tile.appendChild(imgWrap);

        const titleDiv = document.createElement('div');
        titleDiv.style.fontSize = 'var(--text-xs)';
        titleDiv.style.fontWeight = '600';
        titleDiv.style.whiteSpace = 'nowrap';
        titleDiv.style.overflow = 'hidden';
        titleDiv.style.textOverflow = 'ellipsis';
        titleDiv.textContent = m.title || 'Untitled Moment';
        tile.appendChild(titleDiv);

        const subDiv = document.createElement('div');
        subDiv.style.fontSize = '11px';
        subDiv.style.color = 'var(--color-stone)';
        subDiv.style.whiteSpace = 'nowrap';
        subDiv.style.overflow = 'hidden';
        subDiv.style.textOverflow = 'ellipsis';
        subDiv.textContent = m.place || formatDate(m.takenOn);
        tile.appendChild(subDiv);

        tile.onclick = () => {
          window.location.href = `/moment.html?id=${m.id || m._id}`;
        };

        strip.appendChild(tile);
      });

      // Loose media in this year
      (group.media || []).forEach((med) => {
        totalItems++;
        const tile = document.createElement('div');
        tile.className = 'otd-item-tile';

        const thumbUrl = med.urls?.thumb || med.urls?.display;

        const imgWrap = document.createElement('div');
        imgWrap.style.position = 'relative';
        imgWrap.style.aspectRatio = '1/1';
        imgWrap.style.borderRadius = 'var(--radius-sm)';
        imgWrap.style.overflow = 'hidden';
        imgWrap.style.marginBottom = '6px';
        imgWrap.style.backgroundColor = 'var(--color-sand)';

        const img = document.createElement('img');
        img.src = thumbUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.alt = med.caption || 'Memory photo';
        imgWrap.appendChild(img);

        const badge = document.createElement('span');
        badge.className = 'badge badge-terracotta';
        badge.style.position = 'absolute';
        badge.style.bottom = '6px';
        badge.style.left = '6px';
        badge.style.fontSize = '10px';
        badge.textContent = yearLabel;
        imgWrap.appendChild(badge);
        tile.appendChild(imgWrap);

        const capDiv = document.createElement('div');
        capDiv.style.fontSize = 'var(--text-xs)';
        capDiv.style.fontWeight = '600';
        capDiv.style.whiteSpace = 'nowrap';
        capDiv.style.overflow = 'hidden';
        capDiv.style.textOverflow = 'ellipsis';
        capDiv.textContent = med.caption || 'Photo';
        tile.appendChild(capDiv);

        const subDiv = document.createElement('div');
        subDiv.style.fontSize = '11px';
        subDiv.style.color = 'var(--color-stone)';
        subDiv.textContent = med.place || formatDate(med.takenAt);
        tile.appendChild(subDiv);

        tile.onclick = () => {
          openLightbox({ items: [med], startIndex: 0 });
        };

        strip.appendChild(tile);
      });
    });

    if (totalItems > 0) {
      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  } catch {
    section.style.display = 'none';
  }
}

// ============================================================================
// Main Chronological Feed
// ============================================================================
function initFeed() {
  const sentinel = document.getElementById('feed-sentinel');
  const loadMoreBtn = document.getElementById('btn-load-more-feed');

  loadFeedPage(1, true);

  if ('IntersectionObserver' in window && sentinel) {
    feedObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && feedHasMore && !feedLoading) {
        feedPage++;
        loadFeedPage(feedPage, false);
      }
    }, { rootMargin: '400px' });
    feedObserver.observe(sentinel);
  }

  if (loadMoreBtn) {
    loadMoreBtn.onclick = () => {
      if (feedHasMore && !feedLoading) {
        feedPage++;
        loadFeedPage(feedPage, false);
      }
    };
  }
}

async function loadFeedPage(page, isReset = false) {
  const feedList = document.getElementById('feed-list');
  const footerEl = document.getElementById('feed-footer');
  const loadMoreBtn = document.getElementById('btn-load-more-feed');
  if (!feedList) return;

  feedLoading = true;

  try {
    const res = await getFeed({ page, limit: 10 });
    feedLoading = false;
    const items = res.items || [];
    feedHasMore = !!res.hasMore;

    if (isReset) {
      feedList.innerHTML = '';
    }

    if (items.length === 0 && isReset) {
      feedList.innerHTML = `
        <div class="card empty-state" style="padding: var(--space-4xl) var(--space-xl); text-align: center;">
          <img src="/assets/stickers/compass.svg" width="72" height="72" alt="No moments" style="margin-bottom: var(--space-md);">
          <h3 style="font-size: var(--text-xl); margin-bottom: var(--space-2xs);">Your feed is quiet</h3>
          <p class="text-muted" style="font-size: var(--text-sm); max-width: 48ch; margin-bottom: var(--space-xl);">
            When you follow other keepers or publish moments, they will appear here in clean chronological order.
          </p>
          <div style="display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap;">
            <a href="/explore.html" class="btn btn-primary btn-md">Explore public moments</a>
            <a href="/moment-new.html" class="btn btn-sand btn-md">Create your first moment</a>
          </div>
        </div>
      `;
      if (footerEl) footerEl.style.display = 'none';
      return;
    }

    items.forEach((m) => {
      const card = renderFeedMomentCard(m);
      feedList.appendChild(card);
    });

    if (footerEl) {
      footerEl.style.display = 'block';
      if (feedHasMore) {
        if (!('IntersectionObserver' in window)) {
          if (loadMoreBtn) loadMoreBtn.style.display = 'inline-flex';
        }
        const endMsg = document.getElementById('feed-end-message');
        if (endMsg) endMsg.style.display = 'none';
      } else {
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        const endMsg = document.getElementById('feed-end-message');
        if (endMsg) endMsg.style.display = 'block';
      }
    }
  } catch (err) {
    feedLoading = false;
    if (isReset) {
      feedList.innerHTML = `
        <div class="card" style="padding: var(--space-2xl); text-align: center;">
          <p style="color: var(--color-brick); font-size: var(--text-sm); margin-bottom: var(--space-md);">Failed to load feed: ${err.message}</p>
          <button id="retry-feed-btn" class="btn btn-sand btn-sm">Try again</button>
        </div>
      `;
      const r = document.getElementById('retry-feed-btn');
      if (r) r.onclick = () => loadFeedPage(1, true);
    } else {
      showToast('Failed to load earlier moments: ' + err.message, 'error');
    }
  }
}

function renderFeedMomentCard(moment) {
  const card = document.createElement('article');
  card.className = 'card moment-card';
  card.setAttribute('aria-label', moment.title || 'Moment');

  // 1. Author Row
  const header = document.createElement('div');
  header.className = 'moment-header';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = 'var(--space-md)';

  const authorLink = document.createElement('a');
  authorLink.href = `/profile.html?u=${encodeURIComponent(moment.owner?.username || '')}`;
  authorLink.style.display = 'flex';
  authorLink.style.alignItems = 'center';
  authorLink.style.gap = 'var(--space-xs)';
  authorLink.style.textDecoration = 'none';
  authorLink.style.color = 'var(--color-ink)';

  const av = buildAvatar(moment.owner, 'sm');
  authorLink.appendChild(av);

  const authorInfo = document.createElement('div');
  const dName = document.createElement('div');
  dName.style.fontSize = 'var(--text-sm)';
  dName.style.fontWeight = '600';
  dName.textContent = moment.owner?.displayName || moment.owner?.username || 'Keeper';
  authorInfo.appendChild(dName);

  const uName = document.createElement('div');
  uName.style.fontSize = 'var(--text-xs)';
  uName.style.color = 'var(--color-stone)';
  uName.textContent = `@${moment.owner?.username || ''} · ${formatTimeAgo(moment.createdAt)}`;
  authorInfo.appendChild(uName);

  authorLink.appendChild(authorInfo);
  header.appendChild(authorLink);

  // Header Right: Visibility badge or Owner dropdown
  const headerRight = document.createElement('div');
  headerRight.style.display = 'flex';
  headerRight.style.alignItems = 'center';
  headerRight.style.gap = 'var(--space-xs)';

  if (moment.visibility && moment.visibility !== 'followers') {
    const visBadge = document.createElement('span');
    visBadge.className = 'badge badge-stone';
    visBadge.style.fontSize = '11px';
    visBadge.textContent = moment.visibility === 'public' ? 'Public' : 'Private';
    headerRight.appendChild(visBadge);
  }

  // Owner options menu
  if (moment.isOwner) {
    const ownerMenu = buildOwnerMenu(moment, card);
    headerRight.appendChild(ownerMenu);
  }

  header.appendChild(headerRight);
  card.appendChild(header);

  // 2. Title & Caption
  if (moment.title) {
    const title = document.createElement('h3');
    title.style.fontSize = 'var(--text-xl)';
    title.style.fontWeight = '600';
    title.style.marginBottom = 'var(--space-xs)';
    title.textContent = moment.title;
    card.appendChild(title);
  }

  if (moment.caption) {
    const caption = document.createElement('p');
    caption.style.fontSize = 'var(--text-sm)';
    caption.style.lineHeight = '1.6';
    caption.style.marginBottom = 'var(--space-md)';
    caption.style.color = 'var(--color-ink)';
    caption.textContent = moment.caption;
    card.appendChild(caption);
  }

  // 3. Media Layout Container
  const mediaContainer = document.createElement('div');
  mediaContainer.className = 'moment-media-wrapper';
  mediaContainer.style.borderRadius = 'var(--radius-lg)';
  mediaContainer.style.overflow = 'hidden';
  mediaContainer.style.marginBottom = 'var(--space-md)';

  const mediaItems = moment.media || [];
  if (mediaItems.length > 0) {
    renderLayout(mediaContainer, mediaItems, moment.layout || { type: 'grid' }, {
      onTileClick: ({ index }) => {
        openLightbox({
          items: mediaItems,
          startIndex: index,
          isOwner: moment.isOwner
        });
      }
    });
  }
  card.appendChild(mediaContainer);

  // 4. Tags & Metadata Row
  const metaRow = document.createElement('div');
  metaRow.style.display = 'flex';
  metaRow.style.justifyContent = 'space-between';
  metaRow.style.alignItems = 'center';
  metaRow.style.flexWrap = 'wrap';
  metaRow.style.gap = 'var(--space-xs)';
  metaRow.style.marginBottom = 'var(--space-md)';
  metaRow.style.fontSize = 'var(--text-xs)';
  metaRow.style.color = 'var(--color-stone)';

  const datePlace = document.createElement('div');
  let datePlaceStr = '';
  if (moment.takenOn) datePlaceStr += formatDate(moment.takenOn);
  if (moment.place) datePlaceStr += (datePlaceStr ? ' · ' : '') + moment.place;
  datePlace.textContent = datePlaceStr;
  metaRow.appendChild(datePlace);

  if (moment.tags && moment.tags.length > 0) {
    const tagsWrap = document.createElement('div');
    tagsWrap.style.display = 'flex';
    tagsWrap.style.gap = '4px';
    tagsWrap.style.flexWrap = 'wrap';

    moment.tags.forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'badge badge-stone';
      chip.textContent = `#${tag}`;
      tagsWrap.appendChild(chip);
    });
    metaRow.appendChild(tagsWrap);
  }
  card.appendChild(metaRow);

  // 5. Action Footer (Like, Comment, Share)
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.gap = 'var(--space-md)';
  footer.style.paddingTop = 'var(--space-sm)';
  footer.style.borderTop = '1px solid var(--color-sand)';

  // Like Button
  const likeBtn = document.createElement('button');
  likeBtn.className = 'btn-icon';
  likeBtn.setAttribute('aria-label', moment.liked ? 'Unlike moment' : 'Like moment');
  likeBtn.style.gap = '6px';
  likeBtn.style.padding = '6px 10px';
  likeBtn.style.color = moment.liked ? 'var(--color-terracotta)' : 'var(--color-stone)';

  const likeIconWrap = document.createElement('span');
  likeIconWrap.appendChild(icon(moment.liked ? 'heart-filled' : 'heart', { size: 20 }));
  likeBtn.appendChild(likeIconWrap);

  const likeCountSpan = document.createElement('span');
  likeCountSpan.style.fontSize = 'var(--text-sm)';
  likeCountSpan.style.fontWeight = '600';
  likeCountSpan.textContent = String(moment.likesCount || 0);
  likeBtn.appendChild(likeCountSpan);

  likeBtn.onclick = async () => {
    const prevLiked = moment.liked;
    const prevCount = moment.likesCount || 0;

    // Optimistic toggle
    moment.liked = !prevLiked;
    moment.likesCount = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1;

    likeIconWrap.innerHTML = '';
    likeIconWrap.appendChild(icon(moment.liked ? 'heart-filled' : 'heart', { size: 20 }));
    likeCountSpan.textContent = String(moment.likesCount);
    likeBtn.style.color = moment.liked ? 'var(--color-terracotta)' : 'var(--color-stone)';

    if (moment.liked) {
      animateLikePop(likeBtn);
    }

    try {
      const res = await toggleLikeMoment(moment.id || moment._id);
      moment.liked = res.liked;
      moment.likesCount = res.likesCount;
      likeCountSpan.textContent = String(res.likesCount);
    } catch (err) {
      // Rollback
      moment.liked = prevLiked;
      moment.likesCount = prevCount;
      likeIconWrap.innerHTML = '';
      likeIconWrap.appendChild(icon(prevLiked ? 'heart-filled' : 'heart', { size: 20 }));
      likeCountSpan.textContent = String(prevCount);
      likeBtn.style.color = prevLiked ? 'var(--color-terracotta)' : 'var(--color-stone)';
      showToast('Could not update like: ' + err.message, 'error');
    }
  };
  footer.appendChild(likeBtn);

  // Comments Button
  const commentBtn = document.createElement('a');
  commentBtn.href = `/moment.html?id=${moment.id || moment._id}#comments`;
  commentBtn.className = 'btn-icon';
  commentBtn.setAttribute('aria-label', 'View comments');
  commentBtn.style.gap = '6px';
  commentBtn.style.padding = '6px 10px';
  commentBtn.style.color = 'var(--color-stone)';

  commentBtn.appendChild(icon('comment', { size: 20 }));
  const commentCountSpan = document.createElement('span');
  commentCountSpan.style.fontSize = 'var(--text-sm)';
  commentCountSpan.style.fontWeight = '600';
  commentCountSpan.textContent = String(moment.commentsCount || 0);
  commentBtn.appendChild(commentCountSpan);
  footer.appendChild(commentBtn);

  // Share Button
  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn-icon';
  shareBtn.setAttribute('aria-label', 'Share moment link');
  shareBtn.style.marginLeft = 'auto';
  shareBtn.appendChild(icon('share', { size: 18 }));
  shareBtn.onclick = () => {
    const url = `${window.location.origin}/moment.html?id=${moment.id || moment._id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('Moment link copied to clipboard', 'success', 2500))
        .catch(() => showToast(url, 'info', 4000));
    } else {
      showToast(url, 'info', 4000);
    }
  };
  footer.appendChild(shareBtn);

  card.appendChild(footer);
  return card;
}

function buildOwnerMenu(moment, cardElement) {
  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown';

  const btn = document.createElement('button');
  btn.className = 'btn-icon';
  btn.setAttribute('aria-label', 'Moment options');
  btn.appendChild(icon('more', { size: 18 }));
  dropdown.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.style.right = '0';
  menu.style.left = 'auto';

  // Edit Option
  const editLink = document.createElement('a');
  editLink.href = `/moment-new.html?edit=${moment.id || moment._id}`;
  editLink.className = 'dropdown-item';
  editLink.appendChild(icon('edit', { size: 16 }));
  const editText = document.createElement('span');
  editText.textContent = 'Edit moment';
  editLink.appendChild(editText);
  menu.appendChild(editLink);

  // Delete Option
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'dropdown-item danger';
  delBtn.appendChild(icon('trash', { size: 16 }));
  const delText = document.createElement('span');
  delText.textContent = 'Delete moment';
  delBtn.appendChild(delText);

  delBtn.onclick = () => {
    dropdown.classList.remove('open');
    showConfirmDialog({
      title: 'Delete this moment?',
      message: 'This moment will be removed from your feed and profile. Your photographs will remain safe in your Library.',
      confirmLabel: 'Delete moment',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteMoment(moment.id || moment._id);
          cardElement.style.transition = 'opacity 250ms ease, transform 250ms ease';
          cardElement.style.opacity = '0';
          cardElement.style.transform = 'scale(0.96)';
          setTimeout(() => cardElement.remove(), 250);
          showToast('Moment deleted successfully', 'success', 2000);
        } catch (err) {
          showToast('Failed to delete moment: ' + err.message, 'error');
        }
      }
    });
  };
  menu.appendChild(delBtn);

  dropdown.appendChild(menu);

  btn.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  };

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  return dropdown;
}
