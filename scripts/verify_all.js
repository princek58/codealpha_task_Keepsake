const { execSync } = require('child_process');

console.log('=== RUNNING VERIFY:ALL ===');

try {
  console.log('\n[1/3] Auditing CSS design tokens...');
  execSync('node scripts/audit_tokens.js', { stdio: 'inherit' });

  console.log('\n[2/3] Running automated tests...');
  execSync('npm test', { stdio: 'inherit' });

  console.log('\n[3/3] Running server delivery & browser verification...');
  execSync('node scripts/verify_phase3.js', { stdio: 'inherit' });

  console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY! ===');
  process.exit(0);
} catch (err) {
  console.error('\nVerification failed:', err.message);
  process.exit(1);
}
