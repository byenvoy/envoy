import { config } from "dotenv";
import { printDraftResults, printValidatorResults, saveReport } from "./lib/report";
import { runDraftSuite } from "./suites/draft";
import { runValidatorSuite } from "./suites/validator";

// Load .env.local first (Next.js convention), then .env as a fallback.
config({ path: ".env.local" });
config({ path: ".env" });

function parseArgs(): { suites: ("draft" | "validator")[]; model: string | undefined } {
  const args = process.argv.slice(2);
  const modelIdx = args.indexOf("--model");
  const model = modelIdx >= 0 ? args[modelIdx + 1] : undefined;

  const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--model");
  const suiteArg = positional[0];

  let suites: ("draft" | "validator")[];
  if (!suiteArg || suiteArg === "all") {
    suites = ["draft", "validator"];
  } else if (suiteArg === "draft" || suiteArg === "validator") {
    suites = [suiteArg];
  } else {
    console.error(`Unknown suite: ${suiteArg}. Valid: draft, validator, all`);
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
      console.log("\nRunning draft generation suite...");
      const report = await runDraftSuite(model);
      printDraftResults(report);
      const path = await saveReport(report);
      console.log(`  saved to ${path}`);
      if (report.summary.failed > 0) anyFailed = true;
    } else if (suite === "validator") {
      console.log("\nRunning validator suite...");
      const report = await runValidatorSuite(model);
      printValidatorResults(report);
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
