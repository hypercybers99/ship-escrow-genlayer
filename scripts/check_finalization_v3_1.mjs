import { createClient, chains } from 'genlayer-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const evidenceDir = path.join(__dirname, '../docs/evidence_v3_1');
const finalizationDir = path.join(evidenceDir, 'finalization');
if (!fs.existsSync(finalizationDir)) {
  fs.mkdirSync(finalizationDir, { recursive: true });
}

const client = createClient({ chain: chains.studionet });

function getAllReceiptFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name !== 'finalization' && dirent.name !== 'assessments_raw' && dirent.name !== 'snapshots') {
        results = results.concat(getAllReceiptFiles(fullPath));
      }
    } else if (dirent.isFile() && dirent.name.endsWith('.json')) {
      if (
        !dirent.name.includes('invariant') &&
        !dirent.name.includes('stats') &&
        !dirent.name.includes('live_evidence') &&
        !dirent.name.includes('summary') &&
        !dirent.name.includes('packet_recomputation') &&
        !dirent.name.includes('finalization_log') &&
        !dirent.name.includes('all_submissions') &&
        !dirent.name.includes('probe_v3_1_results')
      ) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

async function getTxWithRetry(txHash) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const tx = await client.getTransaction({ hash: txHash });
      return tx;
    } catch (err) {
      if (err.message && (err.message.includes('429') || err.message.includes('rate limit'))) {
        console.log(`[Rate Limit] backing off on attempt ${attempt} for ${txHash.slice(0, 10)}...`);
        await new Promise(r => setTimeout(r, 4000 * attempt));
      } else {
        if (attempt === 5) throw err;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
}

async function main() {
  const now = new Date();
  const utcIso = now.toISOString();
  const utcSafe = utcIso.replace(/[:.]/g, '-');
  console.log(`====================================================`);
  console.log(`CHECKING FINALIZATION STATUS ON STUDIONET (V3.1)`);
  console.log(`Timestamp: ${utcIso}`);
  console.log(`====================================================`);

  const files = getAllReceiptFiles(evidenceDir);
  console.log(`Found ${files.length} receipt files to check.`);

  const txCache = new Map();
  const entries = [];
  const countsByStatus = {};

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const file = path.relative(evidenceDir, filePath);
    try {
      const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const txHash = receipt.hash || receipt.transaction_hash || receipt.submit_tx_hash || receipt.deploy_receipt?.hash;
      if (!txHash) {
        console.log(`[Skip] No tx hash in ${file}`);
        continue;
      }

      const fileStat = fs.statSync(filePath);
      const initialStatusName = receipt.status_name || receipt.submit_receipt?.status_name || (receipt.status === 5 ? 'ACCEPTED' : (receipt.status === 7 ? 'FINALIZED' : String(receipt.status)));
      const initialTime = receipt.created_at || receipt.timestamp || fileStat.mtime.toISOString();

      let tx = txCache.get(txHash);
      if (!tx) {
        tx = await getTxWithRetry(txHash);
        txCache.set(txHash, tx);
        await new Promise(r => setTimeout(r, 2200));
      }

      const currentStatusName = tx.statusName || tx.status_name || (tx.status === 7 ? 'FINALIZED' : (tx.status === 5 ? 'ACCEPTED' : String(tx.status)));
      const currentResultName = tx.result_name || receipt.result_name;
      const leaderExec = tx.consensus_data?.leader_receipt?.[0]?.execution_result || receipt.consensus_data?.leader_receipt?.[0]?.execution_result;

      countsByStatus[currentStatusName] = (countsByStatus[currentStatusName] || 0) + 1;

      entries.push({
        file,
        tx_hash: txHash,
        initial_status_name: initialStatusName,
        initial_timestamp: initialTime,
        current_status: tx.status,
        current_status_name: currentStatusName,
        current_result_name: currentResultName,
        leader_execution_result: leaderExec,
        fetched_at: utcIso,
      });

      console.log(`[${i + 1}/${files.length}] ${file}: initial=${initialStatusName} -> current=${currentStatusName}`);
    } catch (err) {
      console.warn(`  Error checking ${file}: ${err.message}`);
    }
  }

  const runResult = {
    checked_at: utcIso,
    receipts_checked: entries.length,
    counts_by_status_name: countsByStatus,
    entries,
  };

  const runFilePath = path.join(finalizationDir, `finalization_check_${utcSafe}.json`);
  fs.writeFileSync(runFilePath, JSON.stringify(runResult, null, 2));
  console.log(`\nRun recorded to: ${runFilePath}`);
  console.log("Summary counts:", countsByStatus);
}

main().catch(err => {
  console.error("Finalization check failed:", err);
  process.exit(1);
});
