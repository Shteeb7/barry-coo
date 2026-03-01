#!/usr/bin/env node

/**
 * Barry Brain Test — Deployment Verification
 *
 * Tests the full brain→Claude→tools→Supabase loop end-to-end.
 * Runs locally with .env loaded.
 */

require('dotenv').config();
const { callBarry } = require('../src/services/brain');

const TEST_PROMPT = `You are Barry, COO of Mythweaver. Run a quick status check:

1. Query the stories table to see how many stories exist and their statuses
2. Query the chapters table to count total chapters
3. Check if there are any stories stuck in generating states

Keep it concise — this is a deployment verification test.`;

async function testBrain() {
  console.log('🧠 Testing Barry\'s brain...\n');
  console.log('📝 Test prompt:', TEST_PROMPT);
  console.log('\n🤖 Calling Claude API via brain service...\n');

  try {
    const response = await callBarry({
      prompt: TEST_PROMPT,
      taskName: 'deployment_test'
    });

    console.log('\n✅ Brain test complete!\n');
    console.log('📊 Response:', response);
    console.log('\n');

    return response;
  } catch (error) {
    console.error('\n❌ Brain test failed:', error);
    process.exit(1);
  }
}

// Run test
testBrain().then(() => {
  console.log('🎩 Brain is working. Barry is thinking.');
  process.exit(0);
});
