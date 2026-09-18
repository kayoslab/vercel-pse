import { defineEvalConfig } from "eve/evals";

/**
 * Suite defaults. Everything here is deterministic — assertions on which tools
 * ran, with what arguments, and what they returned — so no judge model is
 * configured: a failed eval must mean the agent's contract broke, not that a
 * grader had an opinion.
 */
export default defineEvalConfig({});
