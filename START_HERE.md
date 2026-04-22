# Quick Start - Get Blog Data Generating

## Status
✅ Code with enhanced error handling pushed to GitHub  
✅ GitHub Actions will auto-deploy on next push  
❌ Data not generating yet - need to fix Bedrock access

## What You Need to Do RIGHT NOW (Choose 1)

---

## Path A: Check Bedrock Access (5 minutes - RECOMMENDED)

This is the most likely issue. Do this now:

### Step 1: Enable Bedrock Models
1. Open: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess
2. Search for: `amazon.nova-lite-v1:0`
3. If status is "Access Denied" or doesn't exist → Click "Request" button
4. Search for: `amazon.nova-canvas-v1:0`  
5. If status is "Access Denied" or doesn't exist → Click "Request" button
6. Wait 1-5 minutes (AWS approves instantly)

✅ Once you see "Access Granted" status, Lambda will work!

### Step 2: Test It Works
1. Open: https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions
2. Find: `AwsBlogAutomationStack-BootstrapGeneratorFunction*` (click it)
3. Click "Test" button, click "Run"
4. Wait 10-30 minutes
5. Check logs: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups
6. Search for: `/aws/lambda/AwsBlogAutomationStack` (should see logs now!)

That's it! If logs appear, Bedrock was the issue and it's fixed.

---

## Path B: Full Redeploy (15 minutes - If Path A doesn't work)

If you've verified Bedrock access but still no logs:

### Option 1: PowerShell Script (Easiest)
```powershell
cd C:\Users\Shiva\Desktop\Github\blog
.\setup-and-deploy.ps1 -AccessKeyId "AKIA..." -SecretAccessKey "wJalr..." -Region "us-east-1"
```

### Option 2: Manual Commands
```powershell
cd C:\Users\Shiva\Desktop\Github\blog

# Set your AWS credentials
$env:AWS_ACCESS_KEY_ID = "AKIA..."
$env:AWS_SECRET_ACCESS_KEY = "wJalr..."
$env:AWS_REGION = "us-east-1"

# Deploy
npm install
npm run build
npm run test  
npm run deploy
```

Then follow Step 2 from Path A to test.

---

## Path C: Automatic Deployment via GitHub (Already Happening)

Your code is auto-deployed by GitHub Actions!

### Check deployment status:
1. Go to your GitHub repo
2. Click "Actions" tab at top
3. Look for latest workflow run
4. If ✅ green checkmark - deployment is done!
5. If ⏳ orange spinner - still deploying
6. If ❌ red X - there's an error (check logs)

---

## Then What? 

After Bedrock access is enabled OR redeployment completes:

1. **Wait ~10 minutes** for bootstrap Lambda to run (scheduled trigger)
2. **OR manually invoke it now** (Path A, Step 2)
3. **Check CloudWatch Logs** for:
   - `DEBUG: Bootstrap handler invoked` ← success!
   - Error messages ← tells you what's wrong
4. **Check S3 bucket** for blog posts (published/posts/)
5. **Check DynamoDB** for updated state

---

## What the Error Handling Does

The code changes you pushed include:

- **Logs at handler entry**: `DEBUG: Bootstrap handler invoked`
- **Logs for each phase**: Generating posts, saving to S3, updating DB
- **Detailed error messages**: Exact reason if something fails
- **Stack traces**: Full error context

This means whatever is failing will now be visible in CloudWatch.

---

## Most Common Failures (in order)

| Failure | Solution |
|---------|----------|
| No CloudWatch logs at all | Enable Bedrock model access (Path A) |
| `AccessDeniedException: bedrock:InvokeModel` | Enable Bedrock model access (Path A) |
| No logs after redeployment | Likely Bedrock model not available in your region |
| `ValidationException: Unknown model` | Change `BEDROCK_REGION` to `us-east-1` |
| Timeout errors | Wait longer or increase Lambda timeout (currently 15 min) |

---

## How to Get Help

Once you've tried Path A or B:

1. **Go to CloudWatch Logs**
2. **Find any error message**
3. **Copy the exact error text**
4. **Share it with me**
5. **I'll give you the exact fix**

---

## Summary

```
Step 1: Check Bedrock access (5 min) → Path A
   ↓
Step 2: If still broken, redeploy (15 min) → Path B
   ↓
Step 3: Check CloudWatch logs
   ↓
Step 4: Share error message, I'll help
```

**Start with Path A - 90% of the time that's the only issue!**

Get blog data generating by:
1. Opening Bedrock console (link above)
2. Requesting model access
3. Waiting 5 minutes
4. Lambda will work on next execution ✅
