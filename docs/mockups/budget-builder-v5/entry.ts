// The production modules the prototype runs unchanged. `node build.mjs` bundles them into js/real.js as the global `Real`.
export { buildPlan, ENGINE_VERSION } from '@/lib/budget/engine'
export { getBenchmark, benchmarkEveryday } from '@/lib/budget/benchmarks'
export { NODES, NODE_BY_ID } from '@/lib/budget/flow/nodes'
export { createFlow, nextQuestion, answer, skip, defaultFor, flowItems, flowReadiness, acceptDescribed, screenNodes, pruneInapplicable, stageOf, STAGES, MODULE_ORDER, worthAsking } from '@/lib/budget/flow/flow'
export { applyAnswers } from '@/lib/budget/flow/toFacts'
export { knownFromStore } from '@/lib/budget/flow/known'
export { parseSituation, ANSWERABLE } from '@/lib/budget/situationAi'
export { flowCopyEn, flowCopyAr } from '@/lib/i18n/budgetPage/flowCopy'
