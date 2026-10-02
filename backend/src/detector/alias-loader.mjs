/**
 * Lets Node load the engine that lives in the browser app.
 *
 * `src/lib/detection` is the shipped detector, and §37's pipeline is its own stage list,
 * so the service runs *that source* rather than a second copy of the scoring rules whose
 * numbers would silently drift from the one the UI shows. Two things this repo's bundler
 * knows and Node's own loader does not:
 *
 *   - `@/x` means `<repo>/src/x`;
 *   - an import with no extension means the `.ts` file (or `index.ts`) beside it.
 *
 * Type stripping is Node's, so the frontend sources run as written. A file that imports
 * something browser-only would fail here loudly, which is the outcome to prefer over a
 * silent fallback to a different engine.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src");

function withExtension(candidate) {
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  for (const ext of [".ts", ".tsx", ".mts", ".js"]) {
    if (existsSync(candidate + ext)) return candidate + ext;
  }
  const indexed = join(candidate, "index.ts");
  return existsSync(indexed) ? indexed : null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = withExtension(join(SRC_DIR, specifier.slice(2)));
      if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
      throw new Error(`Alias "@/..." has no file behind it: ${specifier}`);
    }
    const parentDir = typeof context.parentURL === "string" ? dirname(fileURLToPath(context.parentURL)) : null;
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (parentDir && relative && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const target = withExtension(resolve(parentDir, specifier));
      if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
