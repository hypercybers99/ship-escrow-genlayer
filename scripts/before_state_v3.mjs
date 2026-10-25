import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const robustnessDir = path.join(__dirname, '../docs/evidence_v2/robustness');
const failuresDir = path.join(__dirname, '../docs/evidence_v2/robustness_failures');
const v22SummaryPath = path.join(__dirname, '../docs/evidence_v2/robustness_v2_2/gate_evaluation_summary.json');
const activeContractPath = path.join(__dirname, '../contracts/ShipEscrowV2.py');

// 1. V2.1 calculations
const files = fs.readdirSync(robustnessDir).filter(f => f.endsWith('.json') && f !== 'robustness_summary.json');
const failureFiles = fs.existsSync(failuresDir)
  ? fs.readdirSync(failuresDir).filter(f => f.endsWith('.json') && f !== 'failures_summary.json')
  : [];

const v21Stats = {
  F1: { attempts: 0, successes: 0, failures: 0, failure_errors: {} },
  F4: { attempts: 0, successes: 0, failures: 0, failure_errors: {} },
  F5: { attempts: 0, successes: 0, failures: 0, failure_errors: {} },
};

for (const file of files) {
  const filePath = path.join(robustnessDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fId = data.fixture_id;
  if (!v21Stats[fId]) continue;
  if (data.submit_receipt?.execution_result === 'SUCCESS') {
    v21Stats[fId].successes++;
  }
}

const failuresSummaryPath = path.join(failuresDir, 'failures_summary.json');
let failuresData = [];
if (fs.existsSync(failuresSummaryPath)) {
  failuresData = JSON.parse(fs.readFileSync(failuresSummaryPath, 'utf8'));
}

for (const fail of failuresData) {
  const fId = fail.fixture || fail.fixture_id;
  if (!v21Stats[fId]) continue;
  v21Stats[fId].failures++;
  const err = fail.leader_payload || fail.error_message || 'Pull request metadata unavailable';
  v21Stats[fId].failure_errors[err] = (v21Stats[fId].failure_errors[err] || 0) + 1;
}

let v21TotalAttempts = 0;
let v21TotalSuccesses = 0;
let v21TotalFailures = 0;

for (const fId of ['F1', 'F4', 'F5']) {
  v21Stats[fId].attempts = v21Stats[fId].successes + v21Stats[fId].failures;
  v21Stats[fId].reliability_pct = (v21Stats[fId].successes / v21Stats[fId].attempts) * 100;
  v21TotalAttempts += v21Stats[fId].attempts;
  v21TotalSuccesses += v21Stats[fId].successes;
  v21TotalFailures += v21Stats[fId].failures;
}

const v21Summary = {
  by_fixture: v21Stats,
  total_attempts: v21TotalAttempts,
  total_successes: v21TotalSuccesses,
  total_failures: v21TotalFailures,
  reliability_pct: (v21TotalSuccesses / v21TotalAttempts) * 100,
};

// 2. V2.2 Gate Batch numbers
const v22Data = JSON.parse(fs.readFileSync(v22SummaryPath, 'utf8'));
const v22Stats = {
  F1: {
    attempts: v22Data.evaluation.F1.attempts,
    successes: v22Data.evaluation.F1.successes,
    failures: v22Data.evaluation.F1.failures,
    reliability_pct: (v22Data.evaluation.F1.successes / v22Data.evaluation.F1.attempts) * 100,
  },
  F4: {
    attempts: v22Data.evaluation.F4.attempts,
    successes: v22Data.evaluation.F4.successes,
    failures: v22Data.evaluation.F4.failures,
    reliability_pct: (v22Data.evaluation.F4.successes / v22Data.evaluation.F4.attempts) * 100,
  },
  F5: {
    attempts: v22Data.evaluation.F5.attempts,
    successes: v22Data.evaluation.F5.successes,
    failures: v22Data.evaluation.F5.failures,
    reliability_pct: (v22Data.evaluation.F5.successes / v22Data.evaluation.F5.attempts) * 100,
  },
};

const v22TotalAttempts = v22Stats.F1.attempts + v22Stats.F4.attempts + v22Stats.F5.attempts;
const v22TotalSuccesses = v22Stats.F1.successes + v22Stats.F4.successes + v22Stats.F5.successes;
const v22TotalFailures = v22Stats.F1.failures + v22Stats.F4.failures + v22Stats.F5.failures;

const v22Summary = {
  by_fixture: v22Stats,
  total_attempts: v22TotalAttempts,
  total_successes: v22TotalSuccesses,
  total_failures: v22TotalFailures,
  reliability_pct: (v22TotalSuccesses / v22TotalAttempts) * 100,
  gate_outcome: v22Data.gateOutcome,
  adopted: v22Data.adopted,
};

// 3. Combined Baseline Reliability
const combinedAttempts = v21TotalAttempts + v22TotalAttempts;
const combinedSuccesses = v21TotalSuccesses + v22TotalSuccesses;
const combinedFailures = v21TotalFailures + v22TotalFailures;
const combinedSummary = {
  total_attempts: combinedAttempts,
  total_successes: combinedSuccesses,
  total_failures: combinedFailures,
  reliability_pct: (combinedSuccesses / combinedAttempts) * 100,
};

// 4. Extract fields validator_fn compares in ShipEscrowV2.py
const code = fs.readFileSync(activeContractPath, 'utf8');
const valFnMatch = code.match(/def validator_fn\(result\).*?:([\s\S]*?)(?=\ndef|\n\s{8}leader_json =)/);
const fields = [];
if (valFnMatch) {
  const body = valFnMatch[1];
  const strComps = [...body.matchAll(/leader_packet\.get\("([^"]+)"\)\s*!=\s*val_packet\.get\("([^"]+)"\)/g)];
  for (const m of strComps) {
    fields.push(m[1]);
  }
  const intComps = [...body.matchAll(/int\(leader_packet\.get\("([^"]+)"/g)];
  for (const m of intComps) {
    if (!fields.includes(m[1])) {
      fields.push(m[1]);
    }
  }
}

const beforeState = {
  generated_at: new Date().toISOString(),
  baseline_tag: 'se-v2-4',
  v2_1_baseline: v21Summary,
  v2_2_gate_batch: v22Summary,
  combined_pre_v3_reliability: combinedSummary,
  v2_1_validator_compared_fields: fields,
};

const outputPath = path.join(__dirname, '../docs/before_state_v3.json');
fs.writeFileSync(outputPath, JSON.stringify(beforeState, null, 2));

console.log('=== BEFORE STATE V3 (MEASURED BASELINE) ===');
console.log(JSON.stringify(beforeState, null, 2));
