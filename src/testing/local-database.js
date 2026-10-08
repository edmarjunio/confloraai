const fs = require("node:fs");
const path = require("node:path");
function clone(value) {
  return JSON.parse(JSON.stringify(value), (_, v) =>
    v?.type === "Buffer" ? Buffer.from(v.data) : v,
  );
}
class LocalDatabase {
  constructor(directory) {
    this.records = new Map();
    this.tail = Promise.resolve();
    this.directory = directory;
    fs.mkdirSync(directory, { recursive: true });
    this.logFile = path.join(directory, "operations.jsonl");
    if (fs.existsSync(this.logFile)) {
      for (const line of fs
        .readFileSync(this.logFile, "utf8")
        .split("\n")
        .filter(Boolean)) {
        for (const op of JSON.parse(line, (_, v) =>
          v?.type === "Buffer" ? Buffer.from(v.data) : v,
        )) {
          this.apply(op);
        }
      }
    }
  }
  apply(op) {
    if (op.type === "delete") {
      this.records.delete(op.path);
      return;
    }
    const old = this.records.get(op.path) || {};
    this.records.set(
      op.path,
      op.merge || op.type === "update"
        ? { ...old, ...clone(op.data) }
        : clone(op.data),
    );
  }
  collection(name) {
    return new LocalQuery(this, name);
  }
  doc(name) {
    return new LocalDocument(this, name);
  }
  batch() {
    const ops = [];
    const batch = {
      set: (ref, data, options = {}) => {
        ops.push({ type: "set", path: ref.path, data, merge: options.merge });
        return batch;
      },
      delete: (ref) => {
        ops.push({ type: "delete", path: ref.path });
        return batch;
      },
      commit: () =>
        this.runTransaction((tx) => {
          ops.forEach((op) => tx.ops.push(op));
          return [];
        }),
    };
    return batch;
  }
  async runTransaction(action) {
    const previous = this.tail;
    let release;
    this.tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const tx = {
        ops: [],
        hasWrites: false,
        get: async (ref) => {
          if (tx.hasWrites) {
            throw Error("Transaction reads must precede writes");
          }
          return ref.snapshot();
        },
        getAll: async (...refs) => Promise.all(refs.map((r) => tx.get(r))),
        set: (ref, data, opts = {}) => {
          tx.hasWrites = true;
          tx.ops.push({
            type: "set",
            path: ref.path,
            data: clone(data),
            merge: opts.merge,
          });
        },
        create: (ref, data) => {
          tx.hasWrites = true;
          tx.ops.push({ type: "create", path: ref.path, data: clone(data) });
        },
        update: (ref, data) => {
          tx.hasWrites = true;
          tx.ops.push({ type: "update", path: ref.path, data: clone(data) });
        },
        delete: (ref) => {
          tx.hasWrites = true;
          tx.ops.push({ type: "delete", path: ref.path });
        },
      };
      const result = await action(tx);
      for (const op of tx.ops) {
        if (op.type === "create" && this.records.has(op.path)) {
          throw Error("Document already exists");
        }
        if (op.type === "update" && !this.records.has(op.path)) {
          throw Error("Document not found");
        }
      }
      if (tx.ops.length) {
        fs.appendFileSync(this.logFile, JSON.stringify(tx.ops) + "\n");
        tx.ops.forEach((op) => this.apply(op));
      }
      return result;
    } finally {
      release();
    }
  }
}
class LocalDocument {
  constructor(db, name) {
    this.db = db;
    this.path = name;
    this.id = name.split("/").at(-1);
  }
  collection(name) {
    return this.db.collection(this.path + "/" + name);
  }
  snapshot() {
    const data = this.db.records.get(this.path);
    return {
      id: this.id,
      ref: this,
      exists: data !== undefined,
      data: () => clone(data ?? null),
    };
  }
  async get() {
    return this.snapshot();
  }
  set(data, opts = {}) {
    return this.db.runTransaction((tx) => tx.set(this, data, opts));
  }
  update(data) {
    return this.db.runTransaction((tx) => tx.update(this, data));
  }
  delete() {
    return this.db.runTransaction((tx) => tx.delete(this));
  }
}
class LocalQuery {
  constructor(db, name, filters = [], sort = null, max = Infinity) {
    Object.assign(this, { db, path: name, filters, sort, max });
  }
  doc(id = require("node:crypto").randomUUID()) {
    return this.db.doc(this.path + "/" + id);
  }
  where(field, operator, value) {
    return new LocalQuery(
      this.db,
      this.path,
      [...this.filters, { field, operator, value }],
      this.sort,
      this.max,
    );
  }
  orderBy(field, direction = "asc") {
    return new LocalQuery(
      this.db,
      this.path,
      this.filters,
      { field, direction },
      this.max,
    );
  }
  limit(max) {
    return new LocalQuery(this.db, this.path, this.filters, this.sort, max);
  }
  snapshot() {
    let docs = [...this.db.records.keys()]
      .filter(
        (p) =>
          p.startsWith(this.path + "/") &&
          p.slice(this.path.length + 1).indexOf("/") === -1,
      )
      .map((p) => this.db.doc(p).snapshot());
    for (const f of this.filters) {
      docs = docs.filter((d) => {
        const v = f.field.split(".").reduce((o, k) => o?.[k], d.data());
        switch (f.operator) {
          case "==":
            return v === f.value;
          case ">=":
            return v >= f.value;
          case "<=":
            return v <= f.value;
          case ">":
            return v > f.value;
          case "<":
            return v < f.value;
          default:
            throw Error("Unsupported query operator");
        }
      });
    }
    if (this.sort) {
      const { field, direction } = this.sort;
      docs.sort((a, b) => {
        const av = field === "__name__" ? a.id : a.data()[field];
        const bv = field === "__name__" ? b.id : b.data()[field];
        return (
          (av === bv ? 0 : av > bv ? 1 : -1) * (direction === "desc" ? -1 : 1)
        );
      });
    }
    docs = docs.slice(0, this.max);
    return {
      docs,
      size: docs.length,
      empty: docs.length === 0,
      forEach: (fn) => docs.forEach(fn),
    };
  }
  async get() {
    return this.snapshot();
  }
  async add(data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}
module.exports = { LocalDatabase };
