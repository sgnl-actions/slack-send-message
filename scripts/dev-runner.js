#!/usr/bin/env node

/**
 * Development runner for testing scripts locally
 */

import script from '../src/script.mjs';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load and parse metadata.yaml.
const metadataPath = path.resolve(process.cwd(), 'metadata.yaml');
let metadata = {};
if (fs.existsSync(metadataPath)) {
  metadata = yaml.load(fs.readFileSync(metadataPath, 'utf8'));
}

// Extract input defaults from metadata.yaml.
function getInputDefaults(meta) {
  const defaults = {};
  if (meta.inputs) {
    for (const [key, val] of Object.entries(meta.inputs)) {
      if (val.default !== undefined) defaults[key] = val.default;
    }
  }
  return defaults;
}

const inputDefaults = getInputDefaults(metadata);

// Use yargs for argument parsing.
const argv = yargs(hideBin(process.argv))
  .option('params', {
    type: 'string',
    describe: 'JSON string of parameters to pass to the script',
    default: '{}'
  })
  .option('secrets', {
    type: 'string',
    describe: 'JSON string of secrets to pass to the script',
    default: '{}'
  })
  .help()
  .argv;

let params = {};
let secrets = {};
try {
  params = Object.assign({}, inputDefaults, argv.params ? JSON.parse(argv.params) : {});
} catch (e) {
  console.error('Failed to parse --params as JSON:', e.message);
  process.exit(1);
}
try {
  secrets = argv.secrets ? JSON.parse(argv.secrets) : {};
} catch (e) {
  console.error('Failed to parse --secrets as JSON:', e.message);
  process.exit(1);
}

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
        const recovery = await script.error({ ...params, error }, context);
        console.log('✅ Recovery successful!');
        console.log('📤 Recovery result:', JSON.stringify(recovery, null, 2));
      } catch (recoveryError) {
        console.error('❌ Recovery failed:', recoveryError.message);
      }
    }
  }
}

runDev().catch(console.error);