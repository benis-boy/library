# Get the current branch name
$originalBranch = git rev-parse --abbrev-ref HEAD

# Check if the "netlify" branch exists
$branchExists = git branch --list netlify

if (-not $branchExists) {
    Write-Host "Creating new branch: netlify"
    git checkout -b netlify
} else {
    Write-Host "Switching to existing branch: netlify"
    git checkout netlify
}

# Add Netlify-related files
git add netlify.toml .netlify/ netlify/

# Commit changes
git commit -m "Update Netlify deployment files"

# Push the "netlify" branch to remote
# git push -u origin netlify

Write-Host "Netlify branch updated and pushed successfully!"

# Switch back to the original branch
git checkout $originalBranch
Write-Host "Switched back to branch: $originalBranch"
