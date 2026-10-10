// Firebase Hosting forwards only __session to dynamic backends.
// Scopes disambiguate root and tenant cookies when both paths match a request.
function readSessionToken(req, scope, legacyName) {
  const cookies = (req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim());
  const prefix = `__session=${scope}.`;
  const current = cookies.find((value) => value.startsWith(prefix));
  if (current) {
    return current.slice(prefix.length);
  }
  const legacyPrefix = `${legacyName}=`;
  return cookies
    .find((value) => value.startsWith(legacyPrefix))
    ?.slice(legacyPrefix.length);
}

function sessionCookie(req, { scope, token, path, maxAge }) {
  const secure = req.secure || process.env.NODE_ENV === "production";
  const value = token ? `${scope}.${token}` : "";
  return `__session=${value}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

module.exports = { readSessionToken, sessionCookie };
