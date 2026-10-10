const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const {
  readSessionToken,
  sessionCookie,
} = require("../security/session-cookie");
const { ensure, text, digest } = require("./validation");
const derive = promisify(scrypt);
async function hashPassword(password) {
  ensure(
    typeof password === "string" &&
      password.length >= 10 &&
      password.length <= 128,
    "A senha deve ter entre 10 e 128 caracteres.",
  );
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt, 64)).toString("hex")}`;
}
async function checkPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 128) {
    return false;
  }
  const [salt, expected] = (encoded || "").split(":");
  if (!salt || !expected) {
    return false;
  }
  const actual = await derive(password, salt, 64);
  const stored = Buffer.from(expected, "hex");
  return stored.length === actual.length && timingSafeEqual(stored, actual);
}
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
function createStoreAuth(repo) {
  const tokenFrom = (req) =>
    readSessionToken(req, `store.${req.tenantId}`, "store_session");
  const cookie = (req, token, age) =>
    sessionCookie(req, {
      scope: `store.${req.tenantId}`,
      token,
      path: `/api/stores/${req.tenantId}`,
      maxAge: age,
    });
  return {
    async resolve(req, _res, next) {
      try {
        const token = tokenFrom(req);
        if (token) {
          const session = await repo.get(
            req.tenantId,
            "sessions",
            digest(token),
          );
          if (session?.expiresAt > Date.now()) {
            const user = await repo.get(req.tenantId, "users", session.userId);
            if (user?.active) {
              req.storeUser = publicUser(user);
            }
          }
        }
        next();
      } catch (error) {
        next(error);
      }
    },
    async register(req) {
      const email = text(req.body.email, 200, true).toLowerCase();
      ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "E-mail inválido.");
      const id = digest(email);
      const user = {
        id,
        email,
        name: text(req.body.name, 100, true),
        passwordHash: await hashPassword(req.body.password),
        role: "CUSTOMER",
        active: true,
      };
      return repo.atomic(req.tenantId, async (tx) => {
        ensure(
          !(await tx.get("users", id)),
          "Já existe uma conta com este e-mail.",
          409,
        );
        tx.put("users", id, user);
        return user;
      });
    },
    async login(req) {
      const id = digest(text(req.body.email, 200, true).toLowerCase());
      const user = await repo.get(req.tenantId, "users", id);
      ensure(
        user?.active &&
          (await checkPassword(req.body.password, user.passwordHash)),
        "E-mail ou senha inválidos.",
        401,
      );
      return user;
    },
    async issue(req, res, user) {
      const previous = tokenFrom(req);
      if (previous) {
        await repo.put(req.tenantId, "sessions", digest(previous), {
          expiresAt: 0,
        });
      }
      const token = randomBytes(32).toString("hex");
      await repo.put(req.tenantId, "sessions", digest(token), {
        userId: user.id,
        expiresAt: Date.now() + 43200000,
      });
      res.setHeader("Set-Cookie", cookie(req, token, 43200));
      return publicUser(user);
    },
    async logout(req, res) {
      const token = tokenFrom(req);
      if (token) {
        await repo.put(req.tenantId, "sessions", digest(token), {
          expiresAt: 0,
        });
      }
      res.setHeader("Set-Cookie", cookie(req, "", 0));
    },
  };
}
module.exports = { hashPassword, checkPassword, createStoreAuth };
