// Keepsake Full Verification Suite Runner
const { execSync } = require('child_process');

const steps = [
  { name: 'CSS Token Audit', cmd: 'node scripts/audit-tokens.js' },
  { name: 'WCAG Token Contrast Audit', cmd: 'node scripts/audit-contrast.js' },
  { name: 'Viewport Responsiveness Verification', cmd: 'node scripts/verify-responsive.js' },
  { name: 'Automated Backend & Integration Tests', cmd: 'npm test' },
  { name: 'Visibility & Privacy Multi-Persona Audit', cmd: 'node scripts/privacy-audit.js' },
  { name: 'WCAG 2.1 AA axe-core Accessibility Audit', cmd: 'node scripts/a11y.js' },
  { name: 'End-to-End Headless Chrome Test Suite', cmd: 'node scripts/e2e.js' }
];

console.log('\n========================================================');
console.log('         KEEPSAKE FULL VERIFICATION SUITE              ');
console.log('========================================================\n');

const results = [];
const startTime = Date.now();

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  const stepNum = `[${i + 1}/${steps.length}]`;
  console.log(`\n${stepNum} RUNNING: ${step.name}...`);
  console.log(`Command: ${step.cmd}\n`);
  
  const stepStart = Date.now();
  try {
    execSync(step.cmd, { stdio: 'inherit', env: process.env });
    const duration = ((Date.now() - stepStart) / 1000).toFixed(1);
    results.push({ name: step.name, status: 'PASSED', duration: `${duration}s` });
    console.log(`\n✓ ${step.name} PASSED (${duration}s)`);
  } catch (err) {
    const duration = ((Date.now() - stepStart) / 1000).toFixed(1);
    results.push({ name: step.name, status: 'FAILED', duration: `${duration}s` });
    console.error(`\n✗ ${step.name} FAILED (${duration}s)`);
    printScorecard(results, false);
    process.exit(1);
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
printScorecard(results, true, totalDuration);
process.exit(0);

function printScorecard(resultsList, allPassed, totalTime) {
  console.log('\n========================================================');
  console.log('              VERIFICATION SCORECARD                    ');
  console.log('========================================================');
  resultsList.forEach((r, idx) => {
    const mark = r.status === 'PASSED' ? '✓' : '✗';
    const num = `${idx + 1}.`.padEnd(3);
    console.log(` ${mark} ${num} ${r.name.padEnd(42)} [${r.status}] (${r.duration})`);
  });
  console.log('--------------------------------------------------------');
  if (allPassed) {
    console.log(`RESULT: ALL CHECKS PASSED (Total: ${totalTime}s)`);
    console.log('Status: 100% PRODUCTION READY');
  } else {
    console.log('RESULT: VERIFICATION SUITE FAILED');
  }
  console.log('========================================================\n');
}
