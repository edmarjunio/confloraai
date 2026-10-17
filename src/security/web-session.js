const { randomBytes, createHash } = require("node:crypto");
const { readSessionToken, sessionCookie } = require("./session-cookie");

function safeUser(user) {
  const safe = {
    ...user,
    hasPin: Boolean(user.pin),
    hasPassword: Boolean(user.password),
  };
  delete safe.password;
  delete safe.pin;
  return safe;
}

function createWebSessions(repo) {
  const memory = new Map();
  const hash = (token) => createHash("sha256").update(token).digest("hex");
  const isolated = (req) => ['1', 'bootstrap'].includes(req.headers['x-conflora-tab-session']);
  const cookieToken = (req) => {
    if (isolated(req)) {
      const bearer = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
      if (bearer) return bearer[1];
      if (req.headers['x-conflora-tab-session'] !== 'bootstrap' || String(req.originalUrl || req.url).split('?')[0] !== '/api/auth/me') return null;
    }
    return readSessionToken(req, "web", "conflora_session");
  };
  const cookie = (req, token, age) =>
    sessionCookie(req, { scope: "web", token, path: "/", maxAge: age });
  async function remove(req) {
    const token = cookieToken(req);
    if (!token) {
      return;
    }
    const key = hash(token);
    if (repo.firestore) {
      await repo.firestore.collection("web_sessions").doc(key).delete();
    }
    memory.delete(key);
  }
  return {
    async issue(req, res, user) {
      if (!isolated(req)) await remove(req);
      const token = randomBytes(32).toString("hex");
      const session = {
        userId: user.id,
        expiresAt: Date.now() + 12 * 3600 * 1000,
      };
      if (repo.firestore) {
        await repo.firestore
          .collection("web_sessions")
          .doc(hash(token))
          .set(session);
      } else {
        memory.set(hash(token), session);
      }
      if (isolated(req)) res.setHeader('X-Conflora-Session', token);
      res.setHeader("Set-Cookie", cookie(req, token, 12 * 3600));
    },
    async logout(req, res) {
      await remove(req);
      if (isolated(req)) res.setHeader('X-Conflora-Session', '');
      else res.setHeader("Set-Cookie", cookie(req, "", 0));
    },
    async resolve(req, _res, next) {
      try {
        const token = cookieToken(req);
        if (token) {
          const session = repo.firestore
            ? (
                await repo.firestore
                  .collection("web_sessions")
                  .doc(hash(token))
                  .get()
              ).data()
            : memory.get(hash(token));
          if (session && session.expiresAt > Date.now()) {
            const user = (await repo.getAllUsers()).find(
              (u) => u.id === session.userId,
            );
            if (user && user.active !== false) {
              req.user = safeUser(user);
            }
          }
        }
        next();
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createWebSessions, safeUser };
