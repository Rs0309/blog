# AWS Blog Automation - Troubleshooting Guide

## Current Situation
- ✅ AWS CloudFormation stack deployed successfully
- ✅ Lambda functions created
- ✅ DynamoDB table created with bootstrap state
- ✅ EventBridge Scheduler configured
- ❌ No CloudWatch logs appearing
- ❌ No blog posts being generated (bootstrap state shows `completed: false`)

## Root Cause Analysis

Based on the database state showing `lastAttemptAt: 2026-04-21T16:53:21.284Z` with `completed: false`, the Lambda **did execute** but **failed silently** before logs could be written.

### Most Likely Causes (in order of probability)

#### 1. **Bedrock Model Access Not Enabled** (MOST LIKELY)
The Lambda tried to invoke Bedrock models but didn't have access.

**Check:**
1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock)
2. Click **Model Access** (bottom-left of sidebar)
3. Search for:
   - `amazon.nova-lite-v1:0` (text generation)
   - `amazon.nova-canvas-v1:0` (image generation)
4. If status shows "Available" - you have access
5. If status shows "Access Denied" or not listed - click **Request** access

**Error it would cause:**
```
AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel
```

**Fix:** After requesting access (usually instant approval):
1. Wait a few minutes
2. The Lambda will work on next execution

---

#### 2. **Lambda IAM Role Missing Bedrock Permissions**
Even if account has Bedrock access, the Lambda execution role might not have permissions.

**Check:**
1. Go to [IAM Console](https://console.aws.amazon.com/iam)
2. Click **Roles**
3. Search for: `AwsBlogAutomationStack-BootstrapGeneratorFunctionServiceRole`
4. Click the role
5. Look for an inline policy or attached policy with `bedrock:InvokeModel`

**Expected policy:**
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ],
  "Resource": [
    "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0",
    "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-canvas-v1:0"
  ]
}
```

**Fix:** If missing, it should be added by CDK. This might require:
1. Redeploy the stack: `npm run deploy` (after setting AWS credentials)
2. Or manually add the policy in IAM console

---

#### 3. **Lambda Timeout or Invocation Error**
The Bedrock API call might be timing out (text generation can take 10-30 seconds).

**Check CloudWatch Logs:**
1. Go to [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)
2. Search for log groups starting with `/aws/lambda/AwsBlogAutomationStack`
3. Click on **BootstrapGeneratorFunction** log group
4. Look for any log streams
5. If found, check for timeout errors or Bedrock response issues

**Expected logs with new error handling:**
```
{"level":"INFO","message":"Bootstrap run started","timestamp":"..."}
{"level":"INFO","message":"Current published count","publishedCount":0}
{"level":"INFO","message":"Posts to generate","remaining":10}
{"level":"INFO","message":"Generating post","index":0,"articleOrdinal":1}
...
```

---

#### 4. **Region Mismatch**
`BEDROCK_REGION` env var doesn't match where models are available.

**Check:**
1. In Lambda environment variables in AWS Console
2. Look for `BEDROCK_REGION`
3. Should be `us-east-1` or another region with Nova models
4. Models may not be available in all regions

**Supported regions for Nova models (as of April 2026):**
- `us-east-1` (recommended)
- `us-west-2`
- Check [AWS Bedrock availability](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html)

---

## Diagnostic Steps (Do These Now)

### Step 1: Check Bedrock Model Access ✓
Visit [AWS Bedrock Model Access](https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess):
- [ ] `amazon.nova-lite-v1:0` - Status
- [ ] `amazon.nova-canvas-v1:0` - Status

### Step 2: Check CloudWatch Logs
Visit [CloudWatch Log Groups](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups):
- [ ] Search for `/aws/lambda/AwsBlogAutomationStack`
- [ ] Look for recent log streams
- [ ] Share any error messages you see

### Step 3: Check EventBridge Execution
Visit [EventBridge Scheduler](https://console.aws.amazon.com/scheduler/home#schedules):
- [ ] Find schedule: `awsblogautomationstack-bootstrap`
- [ ] Check "Execution history"
- [ ] Look for "FAILED" or "SUCCESSFUL" status
- [ ] If failed, click to see error message

### Step 4: Check Lambda Environment Variables
Visit [Lambda Console](https://console.aws.amazon.com/lambda/home):
- [ ] Find: `AwsBlogAutomationStack-BootstrapGeneratorFunction*`
- [ ] Click on it
- [ ] Scroll to "Environment variables"
- [ ] Verify `BEDROCK_REGION` is set correctly

---

## Quick Fix (If You Have AWS Credentials)

Once you provide AWS credentials, I can:

1. **Check what the actual error is** by invoking Lambda manually
2. **View CloudWatch logs** directly
3. **Verify IAM permissions** are correct
4. **Test Bedrock access** from the Lambda
5. **Redeploy if needed** with corrected configuration

---

## Files Modified in This Session

1. **src/handlers/bootstrap.ts**
   - Added comprehensive try-catch error handling
   - Added DEBUG console logging at handler entry
   - Added progress logging before major operations
   - Added detailed error logging with stack traces

2. **src/handlers/daily-rotation.ts**
   - Same enhancements as bootstrap handler
   - Phase-specific error handling for generation and archive
   - Detailed logging for state transitions

3. **debug-lambda.js** (new)
   - Helper script to diagnose configuration issues

---

## Expected Behavior After Fix

1. Lambda is invoked by EventBridge Scheduler
2. Creates 10 blog posts (takes 5-10 minutes depending on Bedrock)
3. CloudWatch logs show:
   - "Bootstrap run started"
   - "Generating post" messages for each post
   - "Bootstrap run completed"
4. DynamoDB state shows `completed: true` with list of created slugs
5. S3 bucket contains:
   - `published/posts/<slug>/index.md` (markdown files)
   - `published/images/<slug>/featured.png` (generated images)
   - `published/posts-manifest.json` (updated manifest)

---

## Contact/Escalation

If after following these steps it still doesn't work:
1. **Share the error message** from CloudWatch logs
2. **Share Bedrock model access status** screenshot
3. I can provide IAM policy JSON if needed
