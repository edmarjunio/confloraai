const { randomBytes, createHash } = require("node:crypto");
const { readSessionToken, sessionCookie } = require("./session-cookie");

function isOwnerAccount(user) {
  if (!user) return false;
  const email = String(user.email || "").trim().toLowerCase();
  return user.id === "usr-edmar" || email === "edmarjuniob@gmail.com";
}

function safeUser(user, activeRoleOverride = null) {
  const owner = isOwnerAccount(user);
  const validRoles = ["ADMIN", "CAIXA", "VENDEDOR", "ENTREGADOR"];
  const effectiveRole =
    owner && activeRoleOverride && validRoles.includes(activeRoleOverride)
      ? activeRoleOverride
      : user.role;
  const safe = {
    ...user,
    role: effectiveRole,
    baseRole: user.role,
    canSwitchProfiles: owner,
    hasPin: Boolean(user.pin || user.pinHash),
    hasPassword: Boolean(user.password || user.passwordHash),
  };
  delete safe.password;
  delete safe.pin;
  delete safe.pinHash;
  delete safe.passwordHash;
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
        activeRole: user.activeRole || null,
        expiresAt: new Date(Date.now() + 12 * 3600 * 1000),
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
    async setActiveRole(req, role) {
      const validRoles = ["ADMIN", "CAIXA", "VENDEDOR", "ENTREGADOR"];
      const normalizedRole = String(role || "").trim().toUpperCase();
      if (!validRoles.includes(normalizedRole)) {
        return { success: false, error: "Perfil inválido para teste." };
      }
      const token = cookieToken(req);
      if (!token) {
        return { success: false, error: "Sessão não encontrada." };
      }
      const key = hash(token);
      const session = repo.firestore
        ? (await repo.firestore.collection("web_sessions").doc(key).get()).data()
        : memory.get(key);
      if (!session) {
        return { success: false, error: "Sessão expirada." };
      }
      const user = await repo.getUserById(session.userId);
      if (!user || !isOwnerAccount(user)) {
        return {
          success: false,
          error: "Apenas o proprietário (Edmar Júnio) pode alternar entre múltiplos perfis de teste.",
        };
      }
      session.activeRole = normalizedRole;
      if (repo.firestore) {
        await repo.firestore.collection("web_sessions").doc(key).set(session, { merge: true });
      } else {
        memory.set(key, session);
      }
      req.user = safeUser(user, normalizedRole);
      return { success: true, user: req.user };
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
          const expiresAt = session?.expiresAt?.toMillis?.() ?? (typeof session?.expiresAt === 'number' ? session.expiresAt : new Date(session?.expiresAt).getTime());
          if (session && expiresAt > Date.now()) {
            const user = await repo.getUserById(session.userId);
            if (user && user.active !== false) {
              req.user = safeUser(user, session.activeRole || null);
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

module.exports = { createWebSessions, safeUser, isOwnerAccount };
