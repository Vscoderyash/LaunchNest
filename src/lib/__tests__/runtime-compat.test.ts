import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

// Vercel's Node runtime can't require() ES-module-only packages. firebase-admin@14
// pulled in jwks-rsa@4 -> jose@6 (ESM only), which crashed every server route that
// imports Firebase Admin with ERR_REQUIRE_ESM. Loading each entry point with
// require(esm) disabled reproduces that environment and fails if it comes back.
const [major, minor] = process.versions.node.split(".").map(Number);
const supportsFlag = major > 22 || (major === 22 && minor >= 12);

describe.skipIf(!supportsFlag)("firebase-admin loads without require(esm)", () => {
  for (const entry of ["firebase-admin/app", "firebase-admin/auth", "firebase-admin/firestore"]) {
    it(entry, () => {
      const out = execFileSync(
        process.execPath,
        ["--no-experimental-require-module", "-e", `require(${JSON.stringify(entry)}); console.log("ok")`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      );
      expect(out.trim()).toBe("ok");
    });
  }
});
