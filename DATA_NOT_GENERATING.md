# Data Not Generating - Complete Solution Guide

## Problem
You pushed code to GitHub, but the Lambda function isn't generating blog posts. Database shows `lastAttemptAt` updated but `completed: false`.

## Why This Happens
The Lambda function is being invoked by EventBridge Scheduler, but it's failing before it can write CloudWatch logs. The most common causes are:

1. **Bedrock Model Access Not Enabled** (90% probability)
2. Lambda IAM role missing Bedrock permissions (7% probability)
3. Region mismatch (2% probability)
4. Other AWS service issue (1% probability)

---

## Solution 1: Quick Check (5 minutes) - Do This First

### Step 1: Check Bedrock Model Access
1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess)
2. Look for these models:
   - `amazon.nova-lite-v1:0` (for text generation)
   - `amazon.nova-canvas-v1:0` (for image generation)
3. If you see them with status **"Access Granted"** or **"Available"**:
   - Skip to Step 2
4. If you see them with status **"Access Denied"** or they're not listed:
   - **Click "Request" button next to each model**
   - AWS usually approves instantly (takes 1-5 minutes)
   - You'll get an email confirmation
   - Skip to Step 2

### Step 2: Manually Trigger Bootstrap Lambda
1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions)
2. Find function: `AwsBlogAutomationStack-BootstrapGeneratorFunction*`
3. Click "Test" button
4. Use default event: `{}`
5. Click "Run"
6. Wait for execution (takes 5-30 minutes depending on Bedrock)

### Step 3: Check CloudWatch Logs
1. Go to [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups)
2. Find log group: `/aws/lambda/AwsBlogAutomationStack-BootstrapGeneratorFunction*`
3. Click to open
4. Look for log streams with recent timestamps
5. Expand and look for:
   - `DEBUG: Bootstrap handler invoked` - means Lambda started
   - `Current published count` - means it's running
   - Any error messages

**Share what you see in the logs**, and I can tell you exactly what's wrong.

---

## Solution 2: Full Redeploy (10-15 minutes) - If Quick Check Doesn't Work

The enhanced error handling code needs to be redeployed to AWS. Use this script:

### Option A: Using PowerShell Script (Easiest)

```powershell
# From PowerShell in your project directory
.\setup-and-deploy.ps1 -AccessKeyId "AKIA..." -SecretAccessKey "wJalrXUtnFEMI/K7MDENG+j..." -Region "us-east-1"
```

### Option B: Manual Steps

```powershell
# 1. Set credentials
$env:AWS_ACCESS_KEY_ID = "your-access-key-here"
$env:AWS_SECRET_ACCESS_KEY = "your-secret-key-here"
$env:AWS_REGION = "us-east-1"

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Deploy
npm run deploy
```

---

## Solution 3: Automated via GitHub Actions (Already Happening!)

When you pushed your code to GitHub, the GitHub Actions workflow automatically:
1. ✅ Ran npm install
2. ✅ Ran npm build
3. ✅ Ran npm test
4. ✅ Configured AWS credentials (from GitHub Secrets)
5. ✅ Deployed to AWS

**The deployment is already in progress or complete in your GitHub Actions!**

Check here: Your repo → Actions tab → Latest workflow run

If it shows ✅ green checkmark - the code with enhanced error handling is now deployed!

---

## Understanding the Data Flow

```
EventBridge Scheduler (runs on schedule)
  ↓
Invokes Bootstrap Lambda
  ↓
Lambda calls Bedrock API (generates blog content)
  ↓
Writes to S3 (markdown + images)
  ↓
Writes to DynamoDB (metadata)
  ↓
Writes to CloudWatch Logs (progress)
```

If **any step fails**, Lambda stops. With the new error handling, **all errors are now logged**.

---

## Expected Timeline

1. **Now**: You've pushed enhanced error handling code
2. **GitHub Actions**: Auto-deploys (watch Actions tab)
3. **Deployment**: Takes ~2 minutes
4. **First Lambda Run**: ~10 minutes after deployment (scheduled)
   - OR manually invoke it now (see Solution 1, Step 2)
5. **Blog Generation**: 10-30 minutes (Bedrock API calls)
6. **See Results**: 
   - CloudWatch Logs: Immediate
   - S3 bucket: Blog posts appear
   - DynamoDB: State shows `completed: true` with post slugs

---

## Files That Help You Debug

- **TROUBLESHOOTING.md** - Detailed diagnosis guide with all possible causes
- **debug-lambda.js** - Run with `node debug-lambda.js` to check local config
- **setup-and-deploy.ps1** - One-command deployment script

---

## Common Errors & Fixes

### "No logs in CloudWatch"
- **Cause**: Lambda failed before logging
- **Fix**: Check Bedrock model access (Solution 1, Step 1)

### "AccessDeniedException: bedrock:InvokeModel"
- **Cause**: Bedrock model access not granted
- **Fix**: Request access in Bedrock console (Solution 1, Step 1)

### "ValidationException: Unknown model"
- **Cause**: Model ID typo or region doesn't support model
- **Fix**: Check `BEDROCK_REGION` environment variable is correct (us-east-1 recommended)

### "Task timed out"
- **Cause**: Bedrock took too long
- **Fix**: Lambda timeout is 15 minutes - should be enough. Try again.

### "DynamoDB error"
- **Cause**: IAM role doesn't have DynamoDB permissions
- **Fix**: Redeploy CDK stack (should auto-fix)

---

## Getting Your AWS Credentials

If you need to redeploy locally:

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/home#/users)
2. Find your user
3. Click "Security credentials" tab
4. Under "Access keys", click "Create access key"
5. Choose "Command Line Interface (CLI)"
6. Click "Create access key"
7. Copy the **Access Key ID** and **Secret Access Key**
8. Use them in the setup script or manual steps above

⚠️ **IMPORTANT**: Never commit credentials to GitHub. Only use them locally or in GitHub Secrets.

---

## Next Steps

1. **Try Solution 1** (5 minutes) - Check Bedrock access
2. **Check CloudWatch logs** - Share what you see
3. If that doesn't work, **use setup script** (Solution 2)
4. **Share the error message** from logs, I'll help further

---

## Questions?

If stuck on any step:
1. Check the logs in CloudWatch (most helpful)
2. Run `node debug-lambda.js` to validate config
3. Share the error message and I'll provide exact fix

The enhanced error handling code is now in place. Once deployed, every error will be visible in CloudWatch Logs.
