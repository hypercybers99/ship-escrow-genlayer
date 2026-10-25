import { execSync } from 'child_process';

const dir = 'E:\\ship-escrow-fixtures';
function sh(cmd) {
  return execSync(cmd, { cwd: dir, encoding: 'utf8' }).trim();
}

console.log("Setting up PR state test fixtures...");

// 1. OPEN non-draft
sh('git checkout main');
sh('git checkout -B probe-state-open');
sh('git commit --allow-empty -m "probe: open non-draft PR"');
sh('git push -u origin probe-state-open --force');
let prOpen = "";
try {
  prOpen = sh('gh pr create --repo hypercybers99/ship-escrow-fixtures --head probe-state-open --base main --title "Probe State: Open Non-Draft" --body "Open non-draft test PR"');
} catch(e) {
  // If already exists
  prOpen = sh('gh pr list --repo hypercybers99/ship-escrow-fixtures --head probe-state-open --json number,url');
}
console.log('PR Open:', prOpen);

// 2. DRAFT
sh('git checkout main');
sh('git checkout -B probe-state-draft');
sh('git commit --allow-empty -m "probe: draft PR"');
sh('git push -u origin probe-state-draft --force');
let prDraft = "";
try {
  prDraft = sh('gh pr create --draft --repo hypercybers99/ship-escrow-fixtures --head probe-state-draft --base main --title "Probe State: Draft" --body "Draft test PR"');
} catch(e) {
  prDraft = sh('gh pr list --repo hypercybers99/ship-escrow-fixtures --head probe-state-draft --json number,url');
}
console.log('PR Draft:', prDraft);

// 3. CLOSED-unmerged
sh('git checkout main');
sh('git checkout -B probe-state-closed');
sh('git commit --allow-empty -m "probe: closed unmerged PR"');
sh('git push -u origin probe-state-closed --force');
let prClosed = "";
try {
  prClosed = sh('gh pr create --repo hypercybers99/ship-escrow-fixtures --head probe-state-closed --base main --title "Probe State: Closed Unmerged" --body "Closed unmerged test PR"');
  const prNum3 = prClosed.match(/pull\/(\d+)/)[1];
  sh(`gh pr close ${prNum3} --repo hypercybers99/ship-escrow-fixtures`);
  console.log(`PR Closed #${prNum3} closed.`);
} catch(e) {
  prClosed = sh('gh pr list --repo hypercybers99/ship-escrow-fixtures --head probe-state-closed --state all --json number,url,state');
}
console.log('PR Closed:', prClosed);

// 4. MERGED (into throwaway branch)
sh('git checkout main');
sh('git checkout -B throwaway-merge-base');
sh('git commit --allow-empty -m "base commit for throwaway merge"');
sh('git push -u origin throwaway-merge-base --force');
sh('git checkout -B probe-state-merged');
sh('git commit --allow-empty -m "probe: merged PR"');
sh('git push -u origin probe-state-merged --force');
let prMerged = "";
try {
  prMerged = sh('gh pr create --repo hypercybers99/ship-escrow-fixtures --head probe-state-merged --base throwaway-merge-base --title "Probe State: Merged" --body "Merged test PR"');
  const prNum4 = prMerged.match(/pull\/(\d+)/)[1];
  sh(`gh pr merge ${prNum4} --repo hypercybers99/ship-escrow-fixtures --merge --admin`);
  console.log(`PR Merged #${prNum4} merged.`);
} catch(e) {
  prMerged = sh('gh pr list --repo hypercybers99/ship-escrow-fixtures --head probe-state-merged --state all --json number,url,state');
}
console.log('PR Merged:', prMerged);

sh('git checkout main');
