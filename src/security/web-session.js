const { randomBytes, createHash } = require("node:crypto");

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
  const cookieToken = (req) =>
    (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("conflora_session="))
      ?.slice(17);
  const cookie = (req, token, age) =>
    `conflora_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${req.secure || process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
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
      await remove(req);
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
      res.setHeader("Set-Cookie", cookie(req, token, 12 * 3600));
    },
    async logout(req, res) {
      await remove(req);
      res.setHeader("Set-Cookie", cookie(req, "", 0));
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
