#!/usr/bin/env node

/**
 * Check CloudWatch Logs without AWS CLI
 * This uses Node.js and AWS SDK to fetch logs
 */

const fs = require('fs');

// Check if credentials are available
const hasCredentials = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;

if (!hasCredentials) {
  console.log('⚠️  AWS credentials not configured in environment');
  console.log('');
  console.log('To check logs, set credentials first:');
  console.log('  $env:AWS_ACCESS_KEY_ID = "AKIA..."');
  console.log('  $env:AWS_SECRET_ACCESS_KEY = "wJalr..."');
  console.log('');
  console.log('Then run: node check-logs.js');
  console.log('');
  console.log('Or visit CloudWatch directly:');
  console.log('  https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups');
  process.exit(0);
}

// If credentials exist, try to fetch logs
async function checkLogs() {
  try {
    const { CloudWatchLogsClient, DescribeLogGroupsCommand, DescribeLogStreamsCommand, GetLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
    
    const client = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-1' });
    
    console.log('🔍 Checking CloudWatch Logs...\n');
    
    // List log groups
    const groupsResponse = await client.send(new DescribeLogGroupsCommand({}));
    const bootstrapGroup = groupsResponse.logGroups.find(g => g.logGroupName.includes('BootstrapGeneratorFunction'));
    
    if (!bootstrapGroup) {
      console.log('❌ No Bootstrap Lambda log group found');
      console.log('   This means the Lambda has never been invoked');
      return;
    }
    
    console.log(`✓ Found log group: ${bootstrapGroup.logGroupName}\n`);
    
    // Get log streams
    const streamsResponse = await client.send(new DescribeLogStreamsCommand({
      logGroupName: bootstrapGroup.logGroupName,
      orderBy: 'LastEventTime',
      descending: true
    }));
    
    if (streamsResponse.logStreams.length === 0) {
      console.log('⚠️  No log streams found (Lambda may not have executed)');
      return;
    }
    
    // Get most recent log stream
    const latestStream = streamsResponse.logStreams[0];
    console.log(`✓ Latest log stream: ${latestStream.logStreamName}`);
    console.log(`  Last event: ${new Date(latestStream.lastEventTimestamp).toISOString()}\n`);
    
    // Get log events
    const eventsResponse = await client.send(new GetLogEventsCommand({
      logGroupName: bootstrapGroup.logGroupName,
      logStreamName: latestStream.logStreamName,
      limit: 100
    }));
    
    if (eventsResponse.events.length === 0) {
      console.log('⚠️  No log events found');
      return;
    }
    
    console.log(`📋 Latest ${eventsResponse.events.length} log entries:\n`);
    
    for (const event of eventsResponse.events) {
      // Parse JSON logs if possible
      try {
        const parsed = JSON.parse(event.message);
        console.log(`[${new Date(event.timestamp).toISOString()}]`);
        console.log(`  Level: ${parsed.level}`);
        console.log(`  Message: ${parsed.message}`);
        if (parsed.error) {
          console.log(`  Error: ${parsed.error}`);
        }
        if (parsed.stack) {
          console.log(`  Stack: ${parsed.stack.split('\n')[0]}`);
        }
      } catch (e) {
        // Plain text log
        console.log(`  ${event.message}`);
      }
      console.log('');
    }
    
    // Summary
    const hasErrors = eventsResponse.events.some(e => {
      try {
        return JSON.parse(e.message).level === 'ERROR';
      } catch {
        return e.message.includes('Error') || e.message.includes('error');
      }
    });
    
    const hasSuccess = eventsResponse.events.some(e => {
      try {
        return JSON.parse(e.message).message.includes('completed');
      } catch {
        return e.message.includes('completed');
      }
    });
    
    console.log('\n' + '='.repeat(60));
    if (hasSuccess) {
      console.log('✅ BOOTSTRAP COMPLETED SUCCESSFULLY');
      console.log('   Blog posts should be in S3 now!');
    } else if (hasErrors) {
      console.log('❌ BOOTSTRAP FAILED WITH ERRORS');
      console.log('   Check the error messages above');
    } else {
      console.log('⏳ BOOTSTRAP IN PROGRESS OR NOT STARTED');
    }
    
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      console.log('❌ AWS SDK not installed');
      console.log('   Run: npm install @aws-sdk/client-cloudwatch-logs');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

checkLogs();
