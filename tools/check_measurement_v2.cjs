const {spawnSync}=require('node:child_process');
const path=require('node:path');
const suites=["test-v2.cjs", "test-payment-success.cjs", "test-checkout-identity.cjs", "test-checkout-intent.cjs", "test-tutorial.cjs", "test-social-session.cjs", "test-preview-state.cjs"];
for(const suite of suites){const result=spawnSync(process.execPath,[path.join(__dirname,'measurement-v2',suite)],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log('Measurement V2 regression suites passed');
