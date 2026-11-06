// Keepsake Moment Full Page Controller
import { getMe, getMomentById, deleteMoment, toggleMomentLike, getMomentComments, createMomentComment, deleteComment, toggleFollowUser, updateMoment } from '../api.js';
import { mountAppShell } from '../shell.js';
import { renderLayout } from '../collage.js';
import { openLightbox } from '../lightbox.js';
import { icon } from '../icons.js';
import { showToast, showConfirmDialog, buildAvatar, formatTimeAgo, formatDate } from '../ui.js';
import { animateLikePop } from '../animations.js';

let currentUser = null;
let currentMoment = null;
let commentsList = [];
let momentId = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const meRes = await getMe();
    currentUser = meRes.user;
  } catch {
    currentUser = null;
  }

  mountAppShell({ activeTab: 'home', user: currentUser, pageTitle: 'Moment' });

  // Handle back button
  const backBtn = document.getElementById('btn-back-nav');
  if (backBtn) {
    backBtn.onclick = () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/home.html';
      }
    };
  }

  const params = new URLSearchParams(window.location.search);
  momentId = params.get('id');

  if (!momentId) {
    showError('No Moment Specified', 'Please select a valid moment from your feed or library.');
    return;
  }

  await loadMoment();
});

async function loadMoment() {
  const skeleton = document.getElementById('moment-skeleton');
  const errorEl = document.getElementById('moment-error');
  const article = document.getElementById('moment-article');
  const commentsSec = document.getElementById('comments');

  try {
    const res = await getMomentById(momentId);
    currentMoment = res.moment;

    if (skeleton) skeleton.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (article) article.style.display = 'block';
    if (commentsSec) commentsSec.style.display = 'block';

    renderMoment();
    await loadComments();

    if (window.location.hash === '#comments') {
      setTimeout(() => {
        commentsSec?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  } catch (err) {
    if (skeleton) skeleton.style.display = 'none';
    const msg = err.status === 404 ? 'This moment is private or has been removed.' : (err.message || 'Failed to load moment.');
    showError('Moment Not Found', msg);
  }
}

function showError(title, desc) {
  const skeleton = document.getElementById('moment-skeleton');
  const errorEl = document.getElementById('moment-error');
  const errorTitle = document.getElementById('moment-error-title');
  const errorDesc = document.getElementById('moment-error-desc');

  if (skeleton) skeleton.style.display = 'none';
  if (errorTitle) errorTitle.textContent = title;
  if (errorDesc) errorDesc.textContent = desc;
  if (errorEl) errorEl.style.display = 'block';
}

function renderMoment() {
  if (!currentMoment) return;
  const m = currentMoment;
  const isOwner = currentUser && (currentUser.id === m.author?.id || currentUser._id === m.author?.id);

  if (m.title) {
    document.title = `${m.title} — Keepsake`;
  }

  // 1. Author header
  const authorWrap = document.getElementById('author-wrap');
  if (authorWrap) {
    authorWrap.innerHTML = '';

    const authorLink = document.createElement('a');
    authorLink.href = `/profile.html?u=${encodeURIComponent(m.author.username)}`;
    authorLink.style.display = 'flex';
    authorLink.style.alignItems = 'center';
    authorLink.style.gap = 'var(--space-sm)';
    authorLink.style.textDecoration = 'none';
    authorLink.style.color = 'inherit';

    const av = buildAvatar(m.author, 'md');
    authorLink.appendChild(av);

    const namesDiv = document.createElement('div');
    const dName = document.createElement('div');
    dName.style.fontWeight = '600';
    dName.style.fontSize = 'var(--text-sm)';
    dName.textContent = m.author.displayName || m.author.username;
    namesDiv.appendChild(dName);

    const uName = document.createElement('div');
    uName.style.fontSize = 'var(--text-xs)';
    uName.style.color = 'var(--color-stone)';
    uName.textContent = `@${m.author.username} · ${formatTimeAgo(m.createdAt)}`;
    namesDiv.appendChild(uName);

    authorLink.appendChild(namesDiv);
    authorWrap.appendChild(authorLink);
  }

  // 2. Author / Owner actions
  const authorActions = document.getElementById('author-actions');
  if (authorActions) {
    authorActions.innerHTML = '';

    if (isOwner) {
      const visSelect = document.createElement('select');
      visSelect.className = 'input input-sm';
      visSelect.setAttribute('aria-label', 'Change visibility');
      visSelect.style.padding = '4px 8px';
      visSelect.style.fontSize = 'var(--text-xs)';
      visSelect.style.borderRadius = 'var(--radius-md)';
      visSelect.innerHTML = `
        <option value="public"${m.visibility === 'public' ? ' selected' : ''}>Public</option>
        <option value="followers"${m.visibility === 'followers' ? ' selected' : ''}>Followers only</option>
        <option value="private"${m.visibility === 'private' ? ' selected' : ''}>Private</option>
      `;
      visSelect.onchange = async () => {
        const newVis = visSelect.value;
        try {
          await updateMoment(m.id || m._id, { visibility: newVis });
          m.visibility = newVis;
          showToast(`Visibility updated to ${newVis}`);
          renderHeaderDetails();
        } catch (err) {
          visSelect.value = m.visibility;
          showToast(err.message || 'Failed to update visibility', 'error');
        }
      };
      authorActions.appendChild(visSelect);

      const editBtn = document.createElement('a');
      editBtn.href = `/moment-new.html?edit=${m.id || m._id}`;
      editBtn.className = 'btn btn-sand btn-sm';
      editBtn.textContent = 'Edit';
      authorActions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost btn-sm';
      delBtn.style.color = 'var(--color-terracotta)';
      delBtn.appendChild(icon('trash', 16));
      delBtn.setAttribute('aria-label', 'Delete moment');
      delBtn.onclick = () => {
        showConfirmDialog({
          title: 'Delete this moment?',
          message: 'This will remove the moment, its comments, and likes. Your photos and videos will remain in your Library.',
          confirmText: 'Delete Moment',
          danger: true,
          onConfirm: async () => {
            try {
              await deleteMoment(m.id || m._id);
              showToast('Moment deleted');
              window.location.href = '/home.html';
            } catch (err) {
              showToast(err.message || 'Could not delete moment', 'error');
            }
          }
        });
      };
      authorActions.appendChild(delBtn);
    } else if (currentUser && m.author) {
      // Follow button
      const followBtn = document.createElement('button');
      let isFollowing = Boolean(m.author.isFollowing);
      followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
      followBtn.textContent = isFollowing ? 'Following' : 'Follow';
      followBtn.onclick = async () => {
        try {
          isFollowing = !isFollowing;
          followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
          followBtn.textContent = isFollowing ? 'Following' : 'Follow';
          await toggleFollowUser(m.author.id || m.author._id);
        } catch {
          isFollowing = !isFollowing;
          followBtn.className = isFollowing ? 'btn btn-sand btn-sm' : 'btn btn-primary btn-sm';
          followBtn.textContent = isFollowing ? 'Following' : 'Follow';
          showToast('Could not update follow', 'error');
        }
      };
      authorActions.appendChild(followBtn);
    }
  }

  // 3. Media Layout mount
  const mediaMount = document.getElementById('moment-media-mount');
  if (mediaMount && m.media && m.media.length > 0) {
    mediaMount.innerHTML = '';
    const layoutEl = renderLayout(m.layout || { type: 'grid' }, m.media, {
      onMediaClick: (index) => {
        openLightbox({ items: m.media, startIndex: index });
      },
      lightboxItems: m.media
    });
    mediaMount.appendChild(layoutEl);
  }

  // 4. Date & Place & Visibility
  const datePlaceEl = document.getElementById('moment-date-place');
  if (datePlaceEl) {
    datePlaceEl.innerHTML = '';
    const dateText = formatDate(m.takenOn || m.createdAt);
    const dateSpan = document.createElement('span');
    dateSpan.textContent = dateText;
    datePlaceEl.appendChild(dateSpan);

    if (m.place) {
      const sep = document.createElement('span');
      sep.textContent = ' · ';
      datePlaceEl.appendChild(sep);

      const placeSpan = document.createElement('span');
      placeSpan.style.display = 'inline-flex';
      placeSpan.style.alignItems = 'center';
      placeSpan.style.gap = '4px';
      placeSpan.appendChild(icon('map-pin', 12));
      const placeText = document.createElement('span');
      placeText.textContent = m.place;
      placeSpan.appendChild(placeText);
      datePlaceEl.appendChild(placeSpan);
    }
  }

  const badgeWrap = document.getElementById('moment-badge-wrap');
  if (badgeWrap) {
    badgeWrap.innerHTML = '';
    if (m.visibility && m.visibility !== 'public') {
      const b = document.createElement('span');
      b.className = 'badge badge-sand';
      b.style.fontSize = '11px';
      b.textContent = m.visibility === 'followers' ? 'Followers only' : 'Private';
      badgeWrap.appendChild(b);
    }
  }

  // 5. Title & Caption
  const titleEl = document.getElementById('moment-title');
  if (titleEl) {
    if (m.title) {
      titleEl.textContent = m.title;
      titleEl.style.display = 'block';
    } else {
      titleEl.style.display = 'none';
    }
  }

  const captionEl = document.getElementById('moment-caption');
  if (captionEl) {
    if (m.caption) {
      captionEl.textContent = m.caption;
      captionEl.style.display = 'block';
    } else {
      captionEl.style.display = 'none';
    }
  }

  // 6. Tags
  const tagsEl = document.getElementById('moment-tags');
  if (tagsEl) {
    tagsEl.innerHTML = '';
    if (Array.isArray(m.tags) && m.tags.length > 0) {
      m.tags.forEach((tag) => {
        const tagBadge = document.createElement('span');
        tagBadge.className = 'badge badge-sand';
        tagBadge.style.cursor = 'default';
        tagBadge.textContent = `#${tag}`;
        tagsEl.appendChild(tagBadge);
      });
    }
  }

  // 7. Like button
  const likeBtn = document.getElementById('btn-like');
  const likeIconWrap = document.getElementById('like-icon-wrap');
  const likeCountEl = document.getElementById('like-count');

  let isLiked = Boolean(m.liked);
  let likesCount = m.likesCount || 0;

  function updateLikeDisplay() {
    if (likeCountEl) likeCountEl.textContent = String(likesCount);
    if (likeIconWrap) {
      likeIconWrap.innerHTML = '';
      if (isLiked) {
        const filled = icon('heart-filled', 18);
        filled.style.color = 'var(--color-terracotta)';
        likeIconWrap.appendChild(filled);
      } else {
        likeIconWrap.appendChild(icon('heart', 18));
      }
    }
  }
  updateLikeDisplay();

  if (likeBtn) {
    likeBtn.onclick = async () => {
      if (!currentUser) {
        showToast('Please log in to like moments');
        return;
      }

      // Optimistic update
      isLiked = !isLiked;
      likesCount += isLiked ? 1 : -1;
      updateLikeDisplay();
      if (isLiked) {
        animateLikePop(likeIconWrap);
      }

      try {
        const res = await toggleMomentLike(m.id || m._id);
        isLiked = Boolean(res.liked);
        likesCount = res.likesCount;
        updateLikeDisplay();
      } catch {
        // Rollback
        isLiked = !isLiked;
        likesCount += isLiked ? 1 : -1;
        updateLikeDisplay();
        showToast('Could not update like', 'error');
      }
    };
  }

  // Comment count & icon
  const commentIconWrap = document.getElementById('comment-icon-wrap');
  if (commentIconWrap) {
    commentIconWrap.innerHTML = '';
    commentIconWrap.appendChild(icon('message-circle', 18));
  }
  const commentCountBadge = document.getElementById('comment-count-badge');
  if (commentCountBadge) {
    commentCountBadge.textContent = String(m.commentsCount || 0);
  }

  // Share button
  const shareIconWrap = document.getElementById('share-icon-wrap');
  if (shareIconWrap) {
    shareIconWrap.innerHTML = '';
    shareIconWrap.appendChild(icon('share', 16));
  }
  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard!');
      } catch {
        showToast('Failed to copy link', 'error');
      }
    };
  }
}

// ============================================================================
// Comments Handling
// ============================================================================
async function loadComments() {
  const commentsListEl = document.getElementById('comments-list');
  const commentsEmptyEl = document.getElementById('comments-empty');
  const headerCountEl = document.getElementById('comments-header-count');
  const commentCountBadge = document.getElementById('comment-count-badge');

  initCommentComposer();

  try {
    const res = await getMomentComments(momentId);
    commentsList = res.items || [];

    if (headerCountEl) headerCountEl.textContent = String(commentsList.length);
    if (commentCountBadge) commentCountBadge.textContent = String(commentsList.length);

    if (commentsList.length === 0) {
      if (commentsListEl) commentsListEl.innerHTML = '';
      if (commentsEmptyEl) commentsEmptyEl.style.display = 'block';
      return;
    }

    if (commentsEmptyEl) commentsEmptyEl.style.display = 'none';
    renderComments();
  } catch {
    if (commentsEmptyEl) {
      commentsEmptyEl.textContent = 'Could not load comments.';
      commentsEmptyEl.style.display = 'block';
    }
  }
}

function initCommentComposer() {
  const composerAvatar = document.getElementById('composer-avatar-mount');
  const form = document.getElementById('comment-form');
  const input = document.getElementById('comment-input');
  const charCount = document.getElementById('comment-char-count');
  const postBtn = document.getElementById('btn-post-comment');

  if (composerAvatar) {
    composerAvatar.innerHTML = '';
    if (currentUser) {
      composerAvatar.appendChild(buildAvatar(currentUser, 'sm'));
    } else {
      composerAvatar.style.display = 'none';
    }
  }

  if (!currentUser) {
    if (form) {
      form.innerHTML = `
        <div style="padding: var(--space-md); background-color: var(--color-sand); border-radius: var(--radius-md); text-align: center; font-size: var(--text-sm);">
          <a href="/auth.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}" style="color: var(--color-ink); font-weight: 600;">Log in</a> to join the conversation.
        </div>
      `;
    }
    return;
  }

  if (input && charCount && postBtn) {
    input.oninput = () => {
      const len = input.value.trim().length;
      charCount.textContent = `${len}/300`;
      postBtn.disabled = len === 0 || len > 300;
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!postBtn.disabled) {
          form?.requestSubmit();
        }
      }
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      postBtn.disabled = true;
      try {
        const res = await createMomentComment(momentId, text);
        input.value = '';
        charCount.textContent = '0/300';
        commentsList.push(res.comment);
        renderComments();

        const headerCountEl = document.getElementById('comments-header-count');
        const commentCountBadge = document.getElementById('comment-count-badge');
        if (headerCountEl) headerCountEl.textContent = String(commentsList.length);
        if (commentCountBadge) commentCountBadge.textContent = String(commentsList.length);

        const commentsEmptyEl = document.getElementById('comments-empty');
        if (commentsEmptyEl) commentsEmptyEl.style.display = 'none';

        showToast('Comment posted');
      } catch (err) {
        showToast(err.message || 'Failed to post comment', 'error');
      } finally {
        postBtn.disabled = false;
      }
    };
  }
}

function renderComments() {
  const container = document.getElementById('comments-list');
  if (!container) return;
  container.innerHTML = '';

  const momentAuthorId = currentMoment?.author?.id || currentMoment?.author?._id;

  commentsList.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'comment-item';

    const authorLink = document.createElement('a');
    authorLink.href = `/profile.html?u=${encodeURIComponent(c.author.username)}`;
    authorLink.style.textDecoration = 'none';
    authorLink.appendChild(buildAvatar(c.author, 'sm'));
    item.appendChild(authorLink);

    const bodyWrap = document.createElement('div');
    bodyWrap.style.flex = '1';
    bodyWrap.style.minWidth = '0';

    const headRow = document.createElement('div');
    headRow.style.display = 'flex';
    headRow.style.alignItems = 'center';
    headRow.style.justifyContent = 'space-between';
    headRow.style.marginBottom = '2px';

    const metaWrap = document.createElement('div');
    metaWrap.style.display = 'flex';
    metaWrap.style.alignItems = 'baseline';
    metaWrap.style.gap = 'var(--space-xs)';

    const dName = document.createElement('span');
    dName.style.fontWeight = '600';
    dName.style.fontSize = 'var(--text-xs)';
    dName.textContent = c.author.displayName || c.author.username;
    metaWrap.appendChild(dName);

    const uName = document.createElement('span');
    uName.style.fontSize = '11px';
    uName.style.color = 'var(--color-stone)';
    uName.textContent = `@${c.author.username} · ${formatTimeAgo(c.createdAt)}`;
    metaWrap.appendChild(uName);

    headRow.appendChild(metaWrap);

    // Delete comment button if user is comment author OR moment author
    const cAuthorId = c.author?.id || c.author?._id;
    const currentUserId = currentUser?.id || currentUser?._id;
    const canDelete = currentUser && (currentUserId === cAuthorId || currentUserId === momentAuthorId);

    if (canDelete) {
      const delCommentBtn = document.createElement('button');
      delCommentBtn.className = 'btn btn-ghost btn-sm';
      delCommentBtn.style.padding = '2px 4px';
      delCommentBtn.style.color = 'var(--color-stone)';
      delCommentBtn.setAttribute('aria-label', 'Delete comment');
      delCommentBtn.appendChild(icon('trash', 14));
      delCommentBtn.onclick = () => {
        showConfirmDialog({
          title: 'Delete this comment?',
          message: 'Are you sure you want to delete this comment?',
          confirmText: 'Delete',
          danger: true,
          onConfirm: async () => {
            try {
              await deleteComment(c.id || c._id);
              commentsList = commentsList.filter((x) => (x.id || x._id) !== (c.id || c._id));
              renderComments();
              const headerCountEl = document.getElementById('comments-header-count');
              const commentCountBadge = document.getElementById('comment-count-badge');
              if (headerCountEl) headerCountEl.textContent = String(commentsList.length);
              if (commentCountBadge) commentCountBadge.textContent = String(commentsList.length);
              if (commentsList.length === 0) {
                const emptyEl = document.getElementById('comments-empty');
                if (emptyEl) emptyEl.style.display = 'block';
              }
              showToast('Comment deleted');
            } catch (err) {
              showToast(err.message || 'Could not delete comment', 'error');
            }
          }
        });
      };
      headRow.appendChild(delCommentBtn);
    }

    bodyWrap.appendChild(headRow);

    const commentText = document.createElement('div');
    commentText.style.fontSize = 'var(--text-sm)';
    commentText.style.lineHeight = '1.5';
    commentText.style.color = 'var(--color-ink)';
    commentText.style.whiteSpace = 'pre-wrap';
    commentText.textContent = c.text;
    bodyWrap.appendChild(commentText);

    item.appendChild(bodyWrap);
    container.appendChild(item);
  });
}

