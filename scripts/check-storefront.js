const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

for (const directory of ["src/storefront", "public/storefront"]) {
  for (const entry of fs.readdirSync(directory)) {
    if (!entry.endsWith(".js")) {
      continue;
    }
    const file = path.join(directory, entry);
    const result = directory.startsWith("public")
      ? spawnSync(process.execPath, ["--input-type=module", "--check"], {
          input: fs.readFileSync(file),
          encoding: "utf8",
        })
      : spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) {
      console.error(file, result.stderr || result.error?.message);
      process.exit(1);
    }
  }
}
console.log("Sintaxe dos módulos SaaS validada.");
