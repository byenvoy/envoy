import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURES_DIR = join(process.cwd(), "evals", "fixtures");

/**
 * Load every .json fixture file in evals/fixtures/<suite>/ and parse it.
 *
 * Fixtures are flat JSON files so they're easy to add, easy to diff in PRs,
 * and don't require any eval-side schema validation — TypeScript will complain
 * at the call site if the shape doesn't match.
 */
export async function loadFixtures<T>(suite: string): Promise<T[]> {
  const dir = join(FIXTURES_DIR, suite);
  const files = await readdir(dir);
  const fixtures: T[] = [];
  for (const file of files.sort()) {
    if (!file.endsWith(".json")) continue;
    const raw = await readFile(join(dir, file), "utf-8");
    fixtures.push(JSON.parse(raw) as T);
  }
  return fixtures;
}
