#!/usr/bin/env node

/**
 * Lambda Debug Helper - Check CloudWatch logs and Lambda execution
 * Run with: node debug-lambda.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔍 AWS Blog Automation - Lambda Debug Helper\n');

  // Check 1: Verify environment variables
  console.log('=== Environment Configuration ===');
  const requiredEnvVars = [
    'AWS_REGION',
    'BEDROCK_REGION',
    'BLOG_BUCKET_NAME',
    'BLOG_TABLE_NAME',
    'TEXT_MODEL_ID',
    'IMAGE_MODEL_ID'
  ];

  const missingVars = [];
  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`✓ ${varName}: ${varName.includes('KEY') ? '***' : value}`);
    } else {
      console.log(`✗ ${varName}: NOT SET`);
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    console.log(`\n⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.log('These should be loaded from GitHub Actions workflow or your .env file\n');
  }

  // Check 2: AWS credentials
  console.log('\n=== AWS Credentials ===');
  const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
  const hasRegion = !!process.env.AWS_REGION;

  console.log(`AWS_ACCESS_KEY_ID: ${hasAccessKey ? '✓ SET' : '✗ NOT SET'}`);
  console.log(`AWS_SECRET_ACCESS_KEY: ${hasSecretKey ? '✓ SET' : '✗ NOT SET'}`);
  console.log(`AWS_REGION: ${hasRegion ? `✓ ${process.env.AWS_REGION}` : '✗ NOT SET'}`);

  if (!hasAccessKey || !hasSecretKey) {
    console.log('\n⚠️  AWS credentials not configured for local debugging');
    console.log('   To debug locally, set:');
    console.log('   $env:AWS_ACCESS_KEY_ID = "your-key"');
    console.log('   $env:AWS_SECRET_ACCESS_KEY = "your-secret"');
    console.log('   $env:AWS_REGION = "us-east-1"\n');
  }

  // Check 3: Deployment artifacts
  console.log('=== Deployment Artifacts ===');
  const artifactPaths = [
    { path: 'cdk.out', desc: 'CDK output directory' },
    { path: 'dist', desc: 'Compiled JavaScript (if built)' },
    { path: 'node_modules', desc: 'Dependencies' }
  ];

  for (const artifact of artifactPaths) {
    const exists = fs.existsSync(path.join(process.cwd(), artifact.path));
    console.log(`${exists ? '✓' : '✗'} ${artifact.desc}: ${artifact.path}`);
  }

  // Check 4: Lambda function files
  console.log('\n=== Lambda Handler Files ===');
  const handlerFiles = [
    'src/handlers/bootstrap.ts',
    'src/handlers/daily-rotation.ts'
  ];

  for (const file of handlerFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const hasErrorHandling = content.includes('try {') && content.includes('catch');
      const hasLogging = content.includes('logger.error');
      console.log(`✓ ${file}`);
      console.log(`  - Error handling: ${hasErrorHandling ? '✓' : '✗'}`);
      console.log(`  - Error logging: ${hasLogging ? '✓' : '✗'}`);
    } else {
      console.log(`✗ ${file}: NOT FOUND`);
    }
  }

  // Check 5: Database table check
  console.log('\n=== DynamoDB State ===');
  if (process.env.BLOG_TABLE_NAME) {
    console.log(`Table name: ${process.env.BLOG_TABLE_NAME}`);
    console.log('Recent state stored (visible from DB console):');
    console.log('  - pk: "STATE#bootstrap"');
    console.log('  - sk: "META"');
    console.log('  - Check if "completed" is false and "lastAttemptAt" is recent');
  }

  // Instructions
  console.log('\n=== Next Steps to Debug ===');
  console.log('1. If AWS credentials are set:');
  console.log('   Run: node debug-lambda.js logs');
  console.log('\n2. Check CloudWatch Logs in AWS Console:');
  console.log('   - Log Group: /aws/lambda/AwsBlogAutomationStack-BootstrapGeneratorFunction*');
  console.log('   - Look for "DEBUG: Bootstrap handler invoked" or error messages');
  console.log('\n3. Check Lambda execution role permissions:');
  console.log('   - Role should have bedrock:InvokeModel permission');
  console.log('   - Role should have dynamodb:* and s3:* permissions');
  console.log('\n4. Verify Bedrock model access in AWS Account:');
  console.log('   - Visit AWS Bedrock console');
  console.log('   - Check "Model access"');
  console.log('   - Ensure amazon.nova-lite-v1:0 and amazon.nova-canvas-v1:0 are enabled');
  console.log('\n5. Check Event History in EventBridge Scheduler:');
  console.log('   - Should show bootstrap schedule execution status');
  console.log('   - Check if Lambda was invoked or if invocation failed');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
