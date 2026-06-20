#!/usr/bin/env node

/**
 * Regression tests for medical-coding-mcp-server structuredContent responses.
 * NLM Clinical Tables — HCPCS Level II (REST + Code Mode).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (haystack.includes(needle)) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    console.log(`  Missing: ${needle}`);
    failedTests++;
  }
}

function assertFileExists(relPath, testName) {
  totalTests++;
  const fullPath = path.join(SERVER_ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
    return fs.readFileSync(fullPath, 'utf-8');
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    failedTests++;
    return '';
  }
}

// Verify core server files exist
const index = assertFileExists('src/index.ts', 'index.ts exists');
const doFile = assertFileExists('src/do.ts', 'do.ts exists');
const catalog = assertFileExists('src/spec/catalog.ts', 'catalog.ts exists');
const adapter = assertFileExists('src/lib/api-adapter.ts', 'api-adapter.ts exists');
const http = assertFileExists('src/lib/http.ts', 'http.ts exists');
const codeMode = assertFileExists('src/tools/code-mode.ts', 'code-mode.ts exists');
const queryData = assertFileExists('src/tools/query-data.ts', 'query-data.ts exists');
const getSchema = assertFileExists('src/tools/get-schema.ts', 'get-schema.ts exists');
const aiStub = assertFileExists('src/ai-stub.ts', 'ai-stub.ts exists');
const wrangler = assertFileExists('wrangler.jsonc', 'wrangler.jsonc exists');
const packageJson = assertFileExists('package.json', 'package.json exists');

// Verify key patterns in source
if (index) {
  assertContains('src/index.ts', index, 'MedicalCodingDataDO', 'index exports MedicalCodingDataDO');
  assertContains('src/index.ts', index, 'MyMCP', 'index exports MyMCP');
  assertContains('src/index.ts', index, '/health', 'index has health endpoint');
  assertContains('src/index.ts', index, '/mcp', 'index has mcp endpoint');
}

if (doFile) {
  assertContains('src/do.ts', doFile, 'RestStagingDO', 'DO extends RestStagingDO');
  assertContains('src/do.ts', doFile, 'MedicalCodingDataDO', 'DO class named MedicalCodingDataDO');
  // NLM Clinical Tables result sets are small; the DO defines no schema hints.
}

if (catalog) {
  assertContains('src/spec/catalog.ts', catalog, 'ApiCatalog', 'catalog uses ApiCatalog type');
  assertContains('src/spec/catalog.ts', catalog, 'medicalCodingCatalog', 'catalog exports medicalCodingCatalog');
  assertContains('src/spec/catalog.ts', catalog, '/hcpcs/v3/search', 'catalog has HCPCS search endpoint');
}

if (http) {
  assertContains('src/lib/http.ts', http, 'restFetch', 'http uses restFetch from shared');
  assertContains('src/lib/http.ts', http, 'clinicaltables.nlm.nih.gov/api', 'http has NLM Clinical Tables base URL');
  assertContains('src/lib/http.ts', http, 'codingFetch', 'http exports codingFetch');
}

if (adapter) {
  assertContains('src/lib/api-adapter.ts', adapter, 'ApiFetchFn', 'adapter uses ApiFetchFn type');
  assertContains('src/lib/api-adapter.ts', adapter, 'createMedicalCodingApiFetch', 'adapter exports createMedicalCodingApiFetch');
}

if (codeMode) {
  assertContains('src/tools/code-mode.ts', codeMode, 'coding', 'code-mode uses coding prefix');
  assertContains('src/tools/code-mode.ts', codeMode, 'createSearchTool', 'code-mode uses createSearchTool');
  assertContains('src/tools/code-mode.ts', codeMode, 'createExecuteTool', 'code-mode uses createExecuteTool');
}

if (queryData) {
  assertContains('src/tools/query-data.ts', queryData, 'coding_query_data', 'registers coding_query_data');
  assertContains('src/tools/query-data.ts', queryData, 'MEDICAL_CODING_DATA_DO', 'query-data uses MEDICAL_CODING_DATA_DO binding');
}

if (getSchema) {
  assertContains('src/tools/get-schema.ts', getSchema, 'coding_get_schema', 'registers coding_get_schema');
  assertContains('src/tools/get-schema.ts', getSchema, 'MEDICAL_CODING_DATA_DO', 'get-schema uses MEDICAL_CODING_DATA_DO binding');
}

if (wrangler) {
  assertContains('wrangler.jsonc', wrangler, 'MedicalCodingDataDO', 'wrangler has MedicalCodingDataDO class');
  assertContains('wrangler.jsonc', wrangler, 'MEDICAL_CODING_DATA_DO', 'wrangler has MEDICAL_CODING_DATA_DO binding');
  assertContains('wrangler.jsonc', wrangler, '8901', 'wrangler uses port 8901');
  assertContains('wrangler.jsonc', wrangler, 'CODE_MODE_LOADER', 'wrangler has CODE_MODE_LOADER');
}

if (packageJson) {
  assertContains('package.json', packageJson, 'medical-coding-mcp-server', 'package.json has correct name');
  assertContains('package.json', packageJson, '@bio-mcp/shared', 'package.json has shared dependency');
}

if (aiStub) {
  assertContains('src/ai-stub.ts', aiStub, 'jsonSchema', 'ai-stub exports jsonSchema');
}

// Summary
console.log(`\n${passedTests}/${totalTests} tests passed`);
if (failedTests > 0) {
  console.log(`${RED}${failedTests} tests FAILED${RESET}`);
  process.exit(1);
}
