const fs = require('fs');
const path = require('path');

const clientDir = path.resolve(__dirname, '../client');

// 404 Page (Finished editorial page)
const page404 = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#F7F3EC">
  <title>Page Not Found — Keepsake</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/components.css">
</head>
<body class="paper-grain" style="display: flex; flex-direction: column; min-height: 100vh;">
  <header class="navbar" role="banner">
    <nav class="navbar-pill">
      <a href="/" class="navbar-brand">
        <img src="/assets/brand/mark.svg" width="28" height="28" alt="Keepsake">
        <span>Keepsake</span>
      </a>
      <a href="/" class="btn btn-sand btn-sm">Return Home</a>
    </nav>
  </header>

  <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: var(--space-xl);">
    <div class="empty-state" style="max-width: 500px;">
      <img src="/assets/stickers/compass.svg" width="80" height="80" alt="Lost Compass" style="margin-bottom: var(--space-lg);">
      <h1 style="font-size: var(--text-3xl); margin-bottom: var(--space-xs);">Moment Not Found</h1>
      <p class="text-muted" style="margin-bottom: var(--space-xl); font-size: var(--text-base);">
        The page or memory you are searching for does not exist, has been moved, or is private.
      </p>
      <div style="display: flex; gap: var(--space-sm);">
        <a href="/" class="btn btn-primary">Return Home</a>
        <a href="/explore.html" class="btn btn-sand">Explore Public Moments</a>
      </div>
    </div>
  </main>

  <footer class="footer">
    <p>&copy; 2026 Keepsake. Keep the moments that matter.</p>
  </footer>
</body>
</html>`;
fs.writeFileSync(path.join(clientDir, '404.html'), page404);

// Placeholder Shells
const shells = [
  { name: 'auth.html', title: 'Sign In & Register', sticker: 'ticket', desc: 'Secure authentication, login, and registration.' },
  { name: 'home.html', title: 'Feed & Chronological Stream', sticker: 'polaroid', desc: 'Your chronological feed of moments from people you follow.' },
  { name: 'library.html', title: 'Media Library', sticker: 'film-roll', desc: 'Your private archive of uploaded photos and videos.' },
  { name: 'moment-new.html', title: 'Create Moment', sticker: 'camera', desc: 'Collage builder, grid selector, and moment publishing flow.' },
  { name: 'moment.html', title: 'Moment View', sticker: 'star', desc: 'Full-detail moment view with comments and likes.' },
  { name: 'albums.html', title: 'Curated Albums', sticker: 'bookmark', desc: 'Browse and organize your memories into photo albums.' },
  { name: 'album.html', title: 'Album View', sticker: 'pin', desc: 'Album display and public share token viewer.' },
  { name: 'profile.html', title: 'User Profile', sticker: 'mountain', desc: 'User profile, public moments, avatar, and follower lists.' },
  { name: 'explore.html', title: 'Explore Public Moments', sticker: 'sun', desc: 'Discover open moments from the Keepsake community.' },
  { name: 'notifications.html', title: 'Notifications', sticker: 'balloon', desc: 'Review comments, likes, and follower alerts.' },
  { name: 'settings.html', title: 'Account Settings', sticker: 'cassette', desc: 'Profile details, storage quota, and privacy controls.' }
];

for (const shell of shells) {
  const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#F7F3EC">
  <title>${shell.title} — Keepsake</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/components.css">
</head>
<body class="paper-grain" style="display: flex; flex-direction: column; min-height: 100vh;">
  <header class="navbar" role="banner">
    <nav class="navbar-pill">
      <a href="/" class="navbar-brand">
        <img src="/assets/brand/mark.svg" width="28" height="28" alt="Keepsake">
        <span>Keepsake</span>
      </a>
      <ul class="navbar-links">
        <li><a href="/">Home</a></li>
        <li><a href="/styleguide.html">Styleguide</a></li>
      </ul>
      <a href="/" class="btn btn-sand btn-sm">Back</a>
    </nav>
  </header>

  <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: var(--space-xl);">
    <div class="empty-state" style="max-width: 520px;">
      <img src="/assets/stickers/${shell.sticker}.svg" width="72" height="72" alt="${shell.title}" style="margin-bottom: var(--space-md);">
      <span class="badge badge-teal" style="margin-bottom: var(--space-sm);">Coming in Build 3</span>
      <h1 style="font-size: var(--text-2xl); margin-bottom: var(--space-xs);">${shell.title}</h1>
      <p class="text-muted" style="margin-bottom: var(--space-xl); font-size: var(--text-sm);">
        ${shell.desc} This full interface will be built and wired in Build 3 (Real App Pages).
      </p>
      <div style="display: flex; gap: var(--space-sm);">
        <a href="/" class="btn btn-primary">Return Home</a>
        <a href="/styleguide.html" class="btn btn-sand">View Styleguide</a>
      </div>
    </div>
  </main>

  <footer class="footer">
    <p>&copy; 2026 Keepsake. All rights reserved.</p>
  </footer>
</body>
</html>`;
  fs.writeFileSync(path.join(clientDir, shell.name), content);
  console.log(`✓ Created placeholder ${shell.name}`);
}

console.log('✓ Created finished 404.html and 11 placeholder shells.');

