#!/usr/bin/env powershell

# AWS Blog Automation - Credential Setup & Deploy Script
# Run this in PowerShell to set up credentials and redeploy

param(
    [string]$AccessKeyId,
    [string]$SecretAccessKey,
    [string]$Region = "us-east-1"
)

Write-Host "🚀 AWS Blog Automation - Setup & Deploy" -ForegroundColor Cyan
Write-Host ""

# Check if credentials provided
if (-not $AccessKeyId) {
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\setup-and-deploy.ps1 -AccessKeyId <KEY> -SecretAccessKey <SECRET> -Region us-east-1" -ForegroundColor White
    Write-Host ""
    Write-Host "Or set credentials manually before running:" -ForegroundColor Yellow
    Write-Host '  $env:AWS_ACCESS_KEY_ID = "your-access-key"' -ForegroundColor White
    Write-Host '  $env:AWS_SECRET_ACCESS_KEY = "your-secret-key"' -ForegroundColor White
    Write-Host '  $env:AWS_REGION = "us-east-1"' -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Setting AWS credentials..." -ForegroundColor Green

# Set environment variables
$env:AWS_ACCESS_KEY_ID = $AccessKeyId
$env:AWS_SECRET_ACCESS_KEY = $SecretAccessKey
$env:AWS_REGION = $Region

Write-Host "✓ Credentials set" -ForegroundColor Green
Write-Host "✓ Region: $Region" -ForegroundColor Green
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Run this script from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "🔨 Building TypeScript..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build successful" -ForegroundColor Green
Write-Host ""

Write-Host "🧪 Running tests..." -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tests failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Tests passed" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Deploying to AWS..." -ForegroundColor Cyan
Write-Host "   This may take 1-2 minutes..." -ForegroundColor Gray
npm run deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Check CloudWatch Logs:" -ForegroundColor White
Write-Host "     https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups" -ForegroundColor Cyan
Write-Host "     Search for: /aws/lambda/AwsBlogAutomationStack-BootstrapGeneratorFunction" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Verify Bedrock Model Access:" -ForegroundColor White
Write-Host "     https://console.aws.amazon.com/bedrock/home#/modelaccess" -ForegroundColor Cyan
Write-Host "     Ensure amazon.nova-lite-v1:0 and amazon.nova-canvas-v1:0 are available" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Bootstrap will run automatically in ~10 minutes" -ForegroundColor White
Write-Host "     Or manually invoke the Lambda from AWS Console" -ForegroundColor Gray
Write-Host ""
