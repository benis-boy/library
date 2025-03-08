# Make the git commit
if (-not (Test-Path .git)) {
    Write-Host "This is not a Git repository. Exiting..." -ForegroundColor Red
    exit 1
}
git add .
git commit -m "automated commit"
git push

# Fetch latest changes from remote
git fetch origin netlify
git checkout netlify -- netlify.toml .netlify/ netlify/ 2>$null
$branchExists = git rev-parse --verify origin/netlify 2>$null
if (-not $branchExists) {
    Write-Host "Remote branch 'netlify' does not exist. Exiting..." -ForegroundColor Yellow
    exit 0
}

# Check if there are differences - update if needed
$diff = git diff --quiet HEAD origin/netlify -- netlify.toml .netlify/ netlify/
if ($LASTEXITCODE -eq 0) {
    Write-Host "No Netlify update required." -ForegroundColor Green
} else {
    Write-Host "Updating Netlify..." -ForegroundColor Yellow
    .\deployment\deploy-netlify.ps1
}

# run the website deployment. Changes are likely.
npm run deploy