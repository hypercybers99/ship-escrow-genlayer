import { createClient, chains } from 'genlayer-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deploymentsPath = path.join(__dirname, '../deploy/deployments_v3_1.json');
const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
const escrowAddress = deployments.escrow_address;

const rawDir = path.join(__dirname, '../../docs/evidence_v3_1/assessments_raw');
fs.mkdirSync(rawDir, { recursive: true });

const client = createClient({ chain: chains.studionet });

async function main() {
  console.log(`Fetching on-chain submissions from ${escrowAddress}...`);
  let count = 0;
  for (let id = 1; id <= 100; id++) {
    const outPath = path.join(rawDir, `sub_${String(id).padStart(2, '0')}.json`);
    if (fs.existsSync(outPath)) {
      count++;
      continue;
    }
    try {
      await new Promise(r => setTimeout(r, 2500));
      const res = await client.readContract({
        address: escrowAddress,
        functionName: 'get_submission',
        args: [String(id)],
      });
      if (!res) break;
      const sub = typeof res === 'string' ? JSON.parse(res) : res;
      if (!sub || !sub.id || !sub.packet) break;

      fs.writeFileSync(outPath, JSON.stringify(sub, null, 2), 'utf8');
      console.log(`  Fetched sub #${id} (Bounty #${sub.bounty_id}): verdict=${sub.verdict}, payout=${sub.payout_pct}%`);
      count++;
    } catch (err) {
      console.log(`  End of submissions at #${id} (${err.message || err})`);
      break;
    }
  }
  console.log(`Total on-chain submissions saved: ${count}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
