import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DraftResult,
  SuiteReport,
  ValidatorResult,
} from "./types";

const RESULTS_DIR = join(process.cwd(), "evals", "results");

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function pill(pass: boolean): string {
  return pass ? `${c.green}PASS${c.reset}` : `${c.red}FAIL${c.reset}`;
}

export function printDraftResults(report: SuiteReport<DraftResult>): void {
  console.log(`\n${c.bold}Draft generation suite${c.reset} ${c.dim}(${report.model})${c.reset}`);
  console.log(c.dim + "─".repeat(60) + c.reset);

  for (const r of report.results) {
    console.log(`${pill(r.verdict.overall.pass)}  ${c.bold}${r.fixtureId}${c.reset} ${c.dim}— ${r.description}${c.reset}`);
    const checks = r.verdict.checks;
    const dims: [string, { pass: boolean; note: string }][] = [
      ["responsiveness", checks.responsiveness],
      ["grounding", checks.grounding],
      ["scope", checks.scope],
      ["tone", checks.tone],
    ];
    for (const [name, check] of dims) {
      const mark = check.pass ? c.green + "✓" : c.red + "✗";
      console.log(`      ${mark}${c.reset} ${name}: ${c.dim}${check.note}${c.reset}`);
    }
    if (!r.verdict.overall.pass) {
      console.log(`      ${c.yellow}↪${c.reset} ${c.dim}${r.verdict.overall.note}${c.reset}`);
    }
  }

  const { summary } = report;
  console.log(c.dim + "─".repeat(60) + c.reset);
  const rate = summary.total === 0 ? 0 : (summary.passed / summary.total) * 100;
  console.log(
    `${c.bold}${summary.passed}/${summary.total}${c.reset} passed (${rate.toFixed(0)}%)  ${c.dim}${summary.totalInputTokens} in / ${summary.totalOutputTokens} out${c.reset}`
  );
}

export function printValidatorResults(report: SuiteReport<ValidatorResult>): void {
  console.log(`\n${c.bold}Draft validator suite${c.reset} ${c.dim}(${report.model})${c.reset}`);
  console.log(c.dim + "─".repeat(60) + c.reset);

  for (const r of report.results) {
    const allChecksMatch = Object.values(r.checkMatches).every(Boolean);
    const passed = allChecksMatch && r.overallMatch;
    console.log(`${pill(passed)}  ${c.bold}${r.fixtureId}${c.reset} ${c.dim}— ${r.description}${c.reset}`);

    const dims: ("responsiveness" | "accuracy" | "scope" | "completeness")[] = [
      "responsiveness",
      "accuracy",
      "scope",
      "completeness",
    ];
    for (const dim of dims) {
      const matched = r.checkMatches[dim];
      const mark = matched ? c.green + "✓" : c.red + "✗";
      const actualPass = r.verdict.checks[dim].pass;
      const expectedPass = r.expected.checks[dim];
      const suffix = matched
        ? `expected ${expectedPass ? "pass" : "fail"}`
        : `${c.red}expected ${expectedPass ? "pass" : "fail"}, got ${actualPass ? "pass" : "fail"}${c.reset}`;
      console.log(`      ${mark}${c.reset} ${dim}: ${c.dim}${suffix}${c.reset}`);
    }

    if (!r.overallMatch) {
      console.log(
        `      ${c.yellow}↪${c.reset} shouldAutoSend mismatch: ${c.dim}expected ${r.expected.shouldAutoSend}, confidence ${r.verdict.confidence}${c.reset}`
      );
    }
  }

  const { summary } = report;
  console.log(c.dim + "─".repeat(60) + c.reset);
  const rate = summary.total === 0 ? 0 : (summary.passed / summary.total) * 100;
  console.log(
    `${c.bold}${summary.passed}/${summary.total}${c.reset} passed (${rate.toFixed(0)}%)  ${c.dim}${summary.totalInputTokens} in / ${summary.totalOutputTokens} out${c.reset}`
  );
}

export async function saveReport<T>(report: SuiteReport<T>): Promise<string> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(RESULTS_DIR, `${report.suite}-${stamp}.json`);
  await writeFile(path, JSON.stringify(report, null, 2), "utf-8");
  return path;
}
