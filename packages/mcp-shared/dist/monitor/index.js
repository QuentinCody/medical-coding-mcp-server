// interlinked-tdd: exempt -- re-export barrel, no testable surface
/** Monitoring primitive — public surface (engine + provenance ledger). */
export { resolvePath, cleanResult, extractRowSets, rowKey, selectValueFields, reparse, canonicalValue, keyedValueMap, snapshotHash, KEY_SEP, } from "./canonicalize";
export { diffTable, diffSnapshots } from "./diff";
export { defaultMateriality, classifyChanges } from "./materiality";
export { autoDetectKey } from "./key-detect";
export { GENESIS_HASH, computeEntryHash, buildSnapshotRow, verifyChainRows, appendSnapshot, verifySnapshotChain, } from "./snapshot-chain";
export { runOnce } from "./run-once";
export { buildToolCall, parseToolResult, callTool, } from "./internal-call";
export { SOURCES, fdaOrangeBook } from "./sources/index";
//# sourceMappingURL=index.js.map