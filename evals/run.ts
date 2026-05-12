import { config } from "dotenv";
import {
  printAgentResults,
  printDraftResults,
  printValidatorResults,
  saveReport,
} from "./lib/report";
import { runAgentSuite } from "./suites/agent";
import { runDraftSuite } from "./suites/draft";
import { runValidatorSuite } from "./suites/validator";

// Load .env.local first (Next.js convention), then .env as a fallback.
// override: true so values in .env.local beat anything the shell already
// had set — important for evals, since a stale empty-string ANTHROPIC_API_KEY
// in the shell would otherwise silently win.
config({ path: ".env.local", override: true });
config({ path: ".env", override: true });

type Suite = "draft" | "validator" | "agent";
const VALID_SUITES: readonly Suite[] = ["draft", "validator", "agent"] as const;

function parseArgs(): { suites: Suite[]; model: string | undefined } {
  const args = process.argv.slice(2);
  const modelIdx = args.indexOf("--model");
  const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;

  const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--model");
  const suiteArg = positional[0];

  let suites: Suite[];
  if (!suiteArg || suiteArg === "all") {
    suites = ["draft", "validator", "agent"];
  } else if ((VALID_SUITES as readonly string[]).includes(suiteArg)) {
    suites = [suiteArg as Suite];
  } else {
    console.error(`Unknown suite: ${suiteArg}. Valid: ${VALID_SUITES.join(", ")}, all`);
    process.exit(1);
  }

  return { suites, model };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
    process.exit(1);
  }

  const { suites, model } = parseArgs();
  let anyFailed = false;

  for (const suite of suites) {
    if (suite === "draft") {
      console.log("\nRunning draft generation suite (classic pipeline)...");
      const report = await runDraftSuite(model);
      printDraftResults(report);
      const path = await saveReport(report);
      console.log(`  saved to ${path}`);
      if (report.summary.failed > 0) anyFailed = true;
    } else if (suite === "validator") {
      console.log("\nRunning validator suite (classic pipeline)...");
      const report = await runValidatorSuite(model);
      printValidatorResults(report);
      const path = await saveReport(report);
      console.log(`  saved to ${path}`);
      if (report.summary.failed > 0) anyFailed = true;
    } else if (suite === "agent") {
      console.log("\nRunning agent pipeline suite...");
      const report = await runAgentSuite(model);
      printAgentResults(report);
      const path = await saveReport(report);
      console.log(`  saved to ${path}`);
      if (report.summary.failed > 0) anyFailed = true;
    }
  }

  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
