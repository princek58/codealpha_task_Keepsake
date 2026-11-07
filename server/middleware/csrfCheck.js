const config = require('../config');

function csrfCheck(req, res, next) {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const host = req.get('host');

  // If both origin and referer are missing (e.g. server-to-server or test runner)
  if (!origin && !referer) {
    return next();
  }

  const checkUrl = origin || referer;
  try {
    const parsed = new URL(checkUrl);

    // If host matches the incoming host header
    if (host && (parsed.host === host || parsed.hostname === host.split(':')[0])) {
      return next();
    }

    // Match against configured allowed origins
    const isAllowed = config.allowedOrigins.some((allowed) => {
      try {
        const allowedParsed = new URL(allowed);
        return parsed.host === allowedParsed.host;
      } catch {
        return false;
      }
    });

    if (isAllowed) {
      return next();
    }

    // Allow localhost during development or testing
    if (!config.isProduction && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return next();
    }

    return res.status(403).json({ message: 'Cross-origin request rejected' });
  } catch {
    return res.status(403).json({ message: 'Invalid request origin' });
  }
}

module.exports = csrfCheck;
