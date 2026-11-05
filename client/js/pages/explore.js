// Keepsake Explore Page Controller
import { getMe, getExploreMoments, searchUsers, getUserSuggestions, toggleFollowUser } from '../api.js';
import { mountAppShell } from '../shell.js';
import { icon } from '../icons.js';
import { showToast, buildAvatar, debounce } from '../ui.js';

let currentUser = null;
let currentTab = 'moments';
let momentsPage = 1;
let momentsHasMore = false;
let momentsLoading = false;
let momentsList = [];
let searchAbortController = null;
let sentinelObserver = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const meRes = await getMe();
    currentUser = meRes.user;
  } catch {
    currentUser = null;
  }

  mountAppShell({ activeTab: 'explore', user: currentUser, pageTitle: 'Explore' });

  // Mount search icon
  const iconMount = document.getElementById('explore-icon-mount');
  if (iconMount) iconMount.appendChild(icon('search', 16));

  initTabs();
  initSearch();
  initInfiniteScroll();

  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');

  if (q) {
    const searchInput = document.getElementById('explore-search-input');
    if (searchInput) searchInput.value = q;
    switchTab('people');
    performSearch(q);
  } else {
    loadMoments(1, true);
  }
});

function initTabs() {
  const btnMoments = document.getElementById('tab-btn-moments');
  const btnPeople = document.getElementById('tab-btn-people');

  if (btnMoments) btnMoments.onclick = () => switchTab('moments');
  if (btnPeople) btnPeople.onclick = () => switchTab('people');
}

function switchTab(tab) {
  currentTab = tab;
  const btnMoments = document.getElementById('tab-btn-moments');
  const btnPeople = document.getElementById('tab-btn-people');
  const panelMoments = document.getElementById('panel-moments');
  const panelPeople = document.getElementById('panel-people');

  if (btnMoments) {
    btnMoments.classList.toggle('active', tab === 'moments');
    btnMoments.setAttribute('aria-selected', String(tab === 'moments'));
  }
  if (btnPeople) {
    btnPeople.classList.toggle('active', tab === 'people');
    btnPeople.setAttribute('aria-selected', String(tab === 'people'));
  }

  if (panelMoments) panelMoments.style.display = tab === 'moments' ? 'block' : 'none';
  if (panelPeople) panelPeople.style.display = tab === 'people' ? 'block' : 'none';

  if (tab === 'people') {
    const input = document.getElementById('explore-search-input');
    const q = input?.value.trim() || '';
    if (q.length >= 2) {
      performSearch(q);
    } else {
      loadSuggestedPeople();
    }
  }
}

// ============================================================================
// Public Moments Stream
// ============================================================================
async function loadMoments(page = 1, isInitial = false) {
  if (momentsLoading) return;
  momentsLoading = true;

  const skeleton = document.getElementById('explore-moments-skeleton');
  const grid = document.getElementById('explore-moments-grid');
  const emptyEl = document.getElementById('explore-moments-empty');

  if (isInitial && skeleton) skeleton.style.display = 'grid';

  try {
    const res = await getExploreMoments(page, 20);
    const items = res.items || [];
    momentsHasMore = Boolean(res.hasMore);

    if (isInitial) {
      momentsList = items;
      if (skeleton) skeleton.style.display = 'none';
      if (grid) grid.innerHTML = '';
    } else {
      momentsList = momentsList.concat(items);
    }

    if (momentsList.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (grid) grid.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (grid) {
      grid.style.display = 'grid';
      renderMoments(items);
    }
  } catch {
    if (skeleton) skeleton.style.display = 'none';
    if (isInitial && emptyEl) emptyEl.style.display = 'block';
  } finally {
    momentsLoading = false;
  }
}

function renderMoments(items) {
  const grid = document.getElementById('explore-moments-grid');
  if (!grid) return;

  items.forEach((m) => {
    const card = document.createElement('a');
    card.href = `/moment.html?id=${m.id || m._id}`;
    card.className = 'explore-moment-card';

    const coverMedia = m.media?.[0];
    const thumbUrl = coverMedia?.urls?.thumb || coverMedia?.urls?.display;

    const imgWrap = document.createElement('div');
    imgWrap.style.position = 'relative';
    imgWrap.style.aspectRatio = '4/3';
    imgWrap.style.backgroundColor = 'var(--color-sand)';
    imgWrap.style.overflow = 'hidden';

    if (thumbUrl) {
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = m.title || 'Moment';
      img.loading = 'lazy';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      imgWrap.appendChild(img);
    }

    if (m.layout?.type) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-sand';
      badge.style.position = 'absolute';
      badge.style.top = '8px';
      badge.style.left = '8px';
      badge.style.fontSize = '10px';
      badge.textContent = m.layout.type;
      imgWrap.appendChild(badge);
    }

    card.appendChild(imgWrap);

    const body = document.createElement('div');
    body.style.padding = 'var(--space-md)';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.flex = '1';

    // Author row
    if (m.author) {
      const authorRow = document.createElement('div');
      authorRow.style.display = 'flex';
      authorRow.style.alignItems = 'center';
      authorRow.style.gap = 'var(--space-xs)';
      authorRow.style.marginBottom = 'var(--space-xs)';

      const av = buildAvatar(m.author, 'sm');
      authorRow.appendChild(av);

      const nameSpan = document.createElement('span');
      nameSpan.style.fontSize = 'var(--text-xs)';
      nameSpan.style.fontWeight = '600';
      nameSpan.textContent = m.author.displayName || m.author.username;
      authorRow.appendChild(nameSpan);

      body.appendChild(authorRow);
    }

    const title = document.createElement('h3');
    title.style.fontSize = 'var(--text-base)';
    title.style.fontWeight = '600';
    title.style.marginBottom = 'var(--space-xs)';
    title.style.lineHeight = '1.3';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.style.whiteSpace = 'nowrap';
    title.textContent = m.title || 'Untitled Moment';
    body.appendChild(title);

    const footer = document.createElement('div');
    footer.style.marginTop = 'auto';
    footer.style.paddingTop = 'var(--space-xs)';
    footer.style.fontSize = 'var(--text-xs)';
    footer.style.color = 'var(--color-stone)';
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.gap = 'var(--space-md)';

    const likesSpan = document.createElement('span');
    likesSpan.textContent = `${m.likesCount || 0} likes`;
    footer.appendChild(likesSpan);

    const commentsSpan = document.createElement('span');
    commentsSpan.textContent = `${m.commentsCount || 0} comments`;
    footer.appendChild(commentsSpan);

    body.appendChild(footer);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function initInfiniteScroll() {
  const sentinel = document.getElementById('explore-sentinel');
  if (!sentinel || !('IntersectionObserver' in window)) return;

  sentinelObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && momentsHasMore && !momentsLoading && currentTab === 'moments') {
      momentsPage++;
      loadMoments(momentsPage, false);
    }
  }, { rootMargin: '300px' });

  sentinelObserver.observe(sentinel);
}

// ============================================================================
// People & Search Handling
// ============================================================================
function initSearch() {
  const searchInput = document.getElementById('explore-search-input');
  if (!searchInput) return;

  const debounced = debounce((q) => {
    if (q.length >= 2) {
      if (currentTab !== 'people') {
        switchTab('people');
      }
      performSearch(q);
    } else if (currentTab === 'people') {
      loadSuggestedPeople();
    }
  }, 300);

  searchInput.oninput = (e) => {
    debounced(e.target.value.trim());
  };
}

async function performSearch(query) {
  if (searchAbortController) {
    searchAbortController.abort();
  }
  searchAbortController = new AbortController();

  const listEl = document.getElementById('explore-people-list');
  const emptyEl = document.getElementById('explore-people-empty');
  const emptyTitle = document.getElementById('people-empty-title');
  const emptyDesc = document.getElementById('people-empty-desc');

  if (listEl) listEl.innerHTML = '<div class="skeleton" style="height: 60px; margin-bottom: 8px;"></div>';

  try {
    const res = await searchUsers(query, 1, 40);
    const users = res.items || [];
    if (listEl) listEl.innerHTML = '';

    if (users.length === 0) {
      if (emptyTitle) emptyTitle.textContent = `No results for "${query}"`;
      if (emptyDesc) emptyDesc.textContent = 'Check spelling or try a broader search.';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    users.forEach((u) => {
      listEl?.appendChild(renderExploreUserRow(u));
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (listEl) listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
  }
}

async function loadSuggestedPeople() {
  const listEl = document.getElementById('explore-people-list');
  const emptyEl = document.getElementById('explore-people-empty');
  const emptyTitle = document.getElementById('people-empty-title');
  const emptyDesc = document.getElementById('people-empty-desc');

  if (listEl) listEl.innerHTML = '<div class="skeleton" style="height: 60px; margin-bottom: 8px;"></div>';

  try {
    const res = await getUserSuggestions();
    const users = res.items || [];
    if (listEl) listEl.innerHTML = '';

    if (users.length === 0) {
      if (emptyTitle) emptyTitle.textContent = 'No suggestions found';
      if (emptyDesc) emptyDesc.textContent = 'Use the search box above to find friends by name.';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    users.forEach((u) => {
      listEl?.appendChild(renderExploreUserRow(u));
    });
  } catch {
    if (listEl) listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
  }
}

function renderExploreUserRow(user) {
  const card = document.createElement('div');
  card.className = 'explore-user-card';

  const userLink = document.createElement('a');
  userLink.href = `/profile.html?u=${encodeURIComponent(user.username)}`;
  userLink.style.display = 'flex';
  userLink.style.alignItems = 'center';
  userLink.style.gap = 'var(--space-md)';
  userLink.style.textDecoration = 'none';
  userLink.style.color = 'inherit';
  userLink.style.flex = '1';
  userLink.style.overflow = 'hidden';

  const av = buildAvatar(user, 'md');
  userLink.appendChild(av);

  const textWrap = document.createElement('div');
  textWrap.style.overflow = 'hidden';

  const dName = document.createElement('div');
  dName.style.fontSize = 'var(--text-sm)';
  dName.style.fontWeight = '600';
  dName.textContent = user.displayName || user.username;
  textWrap.appendChild(dName);

  const uName = document.createElement('div');
  uName.style.fontSize = 'var(--text-xs)';
  uName.style.color = 'var(--color-stone)';
  uName.textContent = `@${user.username}`;
  textWrap.appendChild(uName);

  if (user.bio) {
    const bioText = document.createElement('div');
    bioText.style.fontSize = 'var(--text-xs)';
    bioText.style.color = 'var(--color-stone)';
    bioText.style.marginTop = '2px';
    bioText.style.whiteSpace = 'nowrap';
    bioText.style.overflow = 'hidden';
    bioText.style.textOverflow = 'ellipsis';
    bioText.textContent = user.bio;
    textWrap.appendChild(bioText);
  }

  userLink.appendChild(textWrap);
  card.appendChild(userLink);

  const isMe = currentUser && (currentUser.id === user.id || currentUser.username === user.username);
  if (currentUser && !isMe) {
    const followBtn = document.createElement('button');
    let isFollowing = Boolean(user.isFollowing);
    followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
    followBtn.textContent = isFollowing ? 'Following' : 'Follow';
    followBtn.onclick = async () => {
      try {
        isFollowing = !isFollowing;
        followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
        followBtn.textContent = isFollowing ? 'Following' : 'Follow';
        await toggleFollowUser(user.id);
      } catch {
        isFollowing = !isFollowing;
        followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
        followBtn.textContent = isFollowing ? 'Following' : 'Follow';
        showToast('Could not update follow status', 'error');
      }
    };
    card.appendChild(followBtn);
  }

  return card;
}

