import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

const rawDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../docs/evidence_v2/assessments_raw');
const files = fs.readdirSync(rawDir).filter(f => f.startsWith('sub_') && f.endsWith('.json'));
files.sort((a, b) => {
  const numA = parseInt(a.replace('sub_', '').replace('.json', ''), 10);
  const numB = parseInt(b.replace('sub_', '').replace('.json', ''), 10);
  return numA - numB;
});

console.log("====================================================");
console.log("RECOMPUTING PACKET COMMITMENTS FOR ON-CHAIN SUBMISSIONS");
console.log(`Total Stored Submissions Found: ${files.length}`);
console.log("====================================================");

const verificationResults = [];
let allPassed = true;

for (const file of files) {
  const filePath = path.join(rawDir, file);
  const sub = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!sub.packet || Object.keys(sub.packet).length === 0) {
    console.error(`Submission #${sub.id}: packet is missing or empty!`);
    allPassed = false;
    continue;
  }

  const canon = canonicalJson(sub.packet);
  const recomputedSha = crypto.createHash('sha256').update(canon, 'utf8').digest('hex');
  const matches = (recomputedSha.toLowerCase() === sub.packet_sha256.toLowerCase());

  if (!matches) {
    allPassed = false;
  }

  console.log(`Submission #${sub.id} (Bounty #${sub.bounty_id}):`);
  console.log(`  Verdict:        ${sub.verdict} (${sub.payout_pct}%)`);
  console.log(`  Gate:           ${sub.gate || sub.packet.gate || "none"}`);
  console.log(`  Labels:         ${JSON.stringify(sub.criterion_results)}`);
  console.log(`  On-Chain SHA:   ${sub.packet_sha256}`);
  console.log(`  Recomputed SHA: ${recomputedSha}`);
  console.log(`  Verified:       ${matches}`);

  verificationResults.push({
    submission_id: sub.id,
    bounty_id: sub.bounty_id,
    pr_url: sub.pr_url,
    head_sha: sub.head_sha,
    verdict: sub.verdict,
    payout_pct: sub.payout_pct,
    criterion_results: sub.criterion_results,
    gate: sub.gate || sub.packet.gate || "none",
    on_chain_packet_sha256: sub.packet_sha256,
    recomputed_sha256: recomputedSha,
    verified: matches,
  });
}

const outputPath = process.argv[2] 
  ? path.join(path.dirname(rawDir), 'packet_recomputation.json')
  : path.join(__dirname, '../docs/evidence_v2/packet_recomputation_v2.json');
fs.writeFileSync(outputPath, JSON.stringify(verificationResults, null, 2));

console.log("====================================================");
console.log(`Recomputation verified: ${allPassed ? "100% MATCH" : "FAILURES DETECTED"}`);
console.log(`Saved output to ${outputPath}`);
console.log("====================================================");
