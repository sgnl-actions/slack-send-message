#!/usr/bin/env node

/**
 * Development runner for testing scripts locally
 */

import script from '../src/script.mjs';


// Parse command line arguments for --params and --secrets
function parseArg(flag) {
  const idx = process.argv.findIndex(arg => arg.startsWith(flag));
  if (idx !== -1) {
    let val = process.argv[idx];
    // Handle --flag=value or --flag value
    if (val.includes('=')) {
      val = val.split('=')[1];
    } else if (process.argv[idx + 1]) {
      val = process.argv[idx + 1];
    }
    return val;
  }
  return null;
}

const paramsArg = parseArg('--params');
const secretsArg = parseArg('--secrets');

const params = paramsArg ? JSON.parse(paramsArg) : {};
const secrets = secretsArg ? JSON.parse(secretsArg) : {};

const context = {
  environment: {
    ENVIRONMENT: 'development',
    ADDRESS: params.address || 'https://slack.com'
  },
  secrets,
  outputs: {},
  partial_results: {},
  current_step: 'start'
};

async function runDev() {
  console.log('🚀 Running job script in development mode...\n');
  console.log('📋 Parameters:', JSON.stringify(params, null, 2));
  console.log('🔧 Context:', JSON.stringify(context, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    const result = await script.invoke(params, context);
    console.log('\n' + '='.repeat(50));
    console.log('✅ Job completed successfully!');
    console.log('📤 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('\n' + '='.repeat(50));
    console.error('❌ Job failed:', error.message);

    if (script.error) {
      console.log('\n🔄 Attempting error recovery...');
      try {
        const recovery = await script.error({...params, error}, context);
        console.log('✅ Recovery successful!');
        console.log('📤 Recovery result:', JSON.stringify(recovery, null, 2));
      } catch (recoveryError) {
        console.error('❌ Recovery failed:', recoveryError.message);
      }
    }
  }
}

runDev().catch(console.error);