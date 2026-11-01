function csrfCheck(req, res, next) {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const host = req.get('host');

  // If both origin and referer are missing (e.g. server-to-server or test runner without origin header)
  if (!origin && !referer) {
    return next();
  }

  const checkUrl = origin || referer;
  try {
    const parsed = new URL(checkUrl);

    // If host matches
    if (host && parsed.host === host) {
      return next();
    }

    const clientOrigin = process.env.CLIENT_ORIGIN;
    if (clientOrigin) {
      try {
        const clientParsed = new URL(clientOrigin);
        if (parsed.host === clientParsed.host) {
          return next();
        }
      } catch {}
    }

    // Allow localhost/127.0.0.1 during development/test
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return next();
    }

    return res.status(403).json({ message: 'Cross-origin request rejected' });
  } catch {
    return res.status(403).json({ message: 'Invalid request origin' });
  }
}

module.exports = csrfCheck;
