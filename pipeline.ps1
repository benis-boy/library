function HandleBook {
    param (
        [string]$bookId
    )
    python .\deployment\modifyExport.py $bookId "book-data\$bookId`_export.md" "book-data\encrypted_files.md" "src\basicBookData.json"
    python .\deployment\encryptExport.py $bookId "book-data\$bookId" "book-data\encrypted_files.md"
    Copy-Item -Path "book-data\$bookId`_navigation.html" -Destination "public\navigation-data\$bookId`_navigation.html" -Force
    Copy-Item -Path "book-data\$bookId" -Destination "public\book-data" -Recurse -Force

    # Remove .webnovel.html files from destination
    $destPath = "public\book-data\$bookId"
    if (Test-Path $destPath) {
        Get-ChildItem -Path $destPath -Recurse -Filter *.webnovel.html | Remove-Item -Force
    }
}
# HandleBook -bookId "PSSJ"
# HandleBook -bookId "WtDR"

function ItemPlaceholder {
    param (
        [string]$bookId
    )
    $filePath = "public\navigation-data\$bookId`_navigation.html"
    (Get-Content $filePath) -replace '<li>Data', '<li>' | Set-Content $filePath
}
# ItemPlaceholder -bookId "WtDR"

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
git diff --quiet HEAD origin/netlify -- netlify.toml .netlify/ netlify/
if ($LASTEXITCODE -eq 0) {
    Write-Host "No Netlify update required." -ForegroundColor Green
}
else {
    Write-Host "Updating Netlify..." -ForegroundColor Yellow
    .\deployment\deploy-netlify.ps1
}

# run the website deployment. Changes are likely.
npm run deploy