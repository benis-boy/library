# ensure current is up to date:
git add netlify.toml .netlify/ netlify/
git commit -m "netlify commit because you forgot to commit"

# Get the current branch name
$originalBranch = git rev-parse --abbrev-ref HEAD

# Define the worktree directory
$worktreeDir = "./netlify-worktree"

# Remove existing worktree if it exists
if (Test-Path $worktreeDir) {
    Write-Host "Removing existing Netlify worktree..."
    git worktree remove --force $worktreeDir
    Remove-Item -Recurse -Force $worktreeDir
}

# Create a new orphan worktree for Netlify
Write-Host "Creating a new worktree for Netlify deployment..."
git worktree add --detach $worktreeDir

# Change to the worktree directory
Set-Location $worktreeDir

# Create and switch to a new orphan branch
# Check if the "netlify" branch already exists
$branchExists = git branch --list netlify

if ($branchExists) {
    Write-Host "Deleting existing netlify branch..."
    git branch -D netlify
}
git checkout --orphan netlify

# Remove all files from the working tree
git rm -rf .

# Restore only the Netlify-related files
git checkout $originalBranch -- netlify.toml .netlify/ netlify/

# Stage and commit Netlify files
git add .
git commit -m "update Netlify"

# Push the Netlify branch to remote
git push -u origin netlify --force

# Switch back to the original directory
Set-Location ..

# Remove the worktree
git worktree remove --force $worktreeDir
