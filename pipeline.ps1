function HandleBook {
    param (
        [string]$bookId
    )

    function InvokePythonStep {
        param(
            [string]$description,
            [string[]]$arguments
        )

        Write-Host $description -ForegroundColor Cyan
        & python @arguments
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Step failed: $description" -ForegroundColor Red
            exit 1
        }
    }

    # Cleanup old folders
    $pathsToRemove = @(
        "book-data\$bookId",
        "book-data\$bookId`_raw",
        "book-data\$bookId`_chapters_manifest.json",
        "book-data\$bookId`_chapters.json",
        "public\book-data\$bookId",
        "public\navigation-data\$bookId`_chapters.json"
    )

    foreach ($path in $pathsToRemove) {
        if (Test-Path $path) {
            Remove-Item -Path $path -Recurse -Force
        }
    }
    
    InvokePythonStep -description "Creating HTML artifacts for $bookId" -arguments @(
        ".\deployment\create_htmls.py",
        $bookId,
        "book-data\$bookId`_export.md",
        "book-data\$bookId`_chapters_manifest.json"
    )

    InvokePythonStep -description "Generating chapter metadata for $bookId" -arguments @(
        ".\deployment\generate_metadata.py",
        $bookId,
        "book-data\$bookId`_chapters_manifest.json",
        "book-data\encrypted_files.md",
        "book-data\$bookId`_chapters.json"
    )

    InvokePythonStep -description "Updating navigation html for $bookId" -arguments @(
        ".\deployment\update_navigation.py",
        $bookId,
        "book-data\$bookId`_chapters.json",
        "book-data\$bookId`_navigation.html"
    )

    InvokePythonStep -description "Updating wordcount for $bookId" -arguments @(
        ".\deployment\update_wordcount.py",
        $bookId,
        "book-data\$bookId",
        "src\basicBookData.json"
    )

    InvokePythonStep -description "Encrypting content for $bookId" -arguments @(
        ".\deployment\encryptExport.py",
        $bookId,
        "book-data\$bookId",
        "book-data\encrypted_files.md"
    )

    Copy-Item -Path "book-data\$bookId`_navigation.html" -Destination "public\navigation-data\$bookId`_navigation.html" -Force
    Copy-Item -Path "book-data\$bookId`_chapters.json" -Destination "public\navigation-data\$bookId`_chapters.json" -Force
    Copy-Item -Path "book-data\$bookId" -Destination "public\book-data" -Recurse -Force

    # Remove .webnovel.html files from destination
    $destPath = "public\book-data\$bookId"
    if (Test-Path $destPath) {
        Get-ChildItem -Path $destPath -Recurse -Filter *.webnovel.html | Remove-Item -Force
    }

    # Replace '#' with '_' in filenames
    Get-ChildItem -Path $destPath -Recurse -File |
    Where-Object { $_.Name -like '*#*' } |
    ForEach-Object {
        $newName = $_.Name -replace '#', '_'
        Rename-Item -Path $_.FullName -NewName $newName -Force
    }
}

function ItemPlaceholder {
    param (
        [string]$bookId
    )
    $filePath = "public\navigation-data\$bookId`_navigation.html"
    (Get-Content $filePath) -replace '<li>Data', '<li>' | Set-Content $filePath
}

function ShowUsage {
    Write-Host "Usage:" -ForegroundColor Cyan
    Write-Host "  .\pipeline.ps1 [--book <BookId> ...] [--commit]"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\pipeline.ps1 --book PSSJ"
    Write-Host "  .\pipeline.ps1 --book PSSJ --book WtDR"
    Write-Host "  .\pipeline.ps1 --book PSSJ --commit"
}

function ParseBookIds {
    param(
        [string]$raw
    )
    return @($raw -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

$bookIds = @()
$shouldCommit = $false
$showHelp = $false

for ($i = 0; $i -lt $args.Count; $i++) {
    $arg = $args[$i]
    switch ($arg.ToLower()) {
        '--book' {
            if ($i + 1 -ge $args.Count) {
                Write-Host "Missing value after --book" -ForegroundColor Red
                ShowUsage
                exit 1
            }
            $bookIds += ParseBookIds -raw $args[$i + 1]
            $i++
        }
        '--commit' {
            $shouldCommit = $true
        }
        '--help' {
            $showHelp = $true
        }
        '-h' {
            $showHelp = $true
        }
        default {
            Write-Host "Unknown argument: $arg" -ForegroundColor Red
            ShowUsage
            exit 1
        }
    }
}

if ($showHelp) {
    ShowUsage
    exit 0
}

$bookIds = @($bookIds | Select-Object -Unique)

foreach ($bookId in $bookIds) {
    HandleBook -bookId $bookId
    ItemPlaceholder -bookId $bookId
}

if (-not $shouldCommit) {
    Write-Host "Done. Skipped git/deploy steps (use --commit to publish)." -ForegroundColor Green
    exit 0
}

# Make the git commit
if (-not (Test-Path .git)) {
    Write-Host "This is not a Git repository. Exiting..." -ForegroundColor Red
    exit 1
}
git add .
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No staged changes to commit." -ForegroundColor Yellow
}
else {
    git commit -m "automated commit"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Commit failed. Exiting..." -ForegroundColor Red
        exit 1
    }
    git push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Push failed. Exiting..." -ForegroundColor Red
        exit 1
    }
}

# Fetch latest changes from remote
git fetch origin netlify
$branchExists = git rev-parse --verify origin/netlify 2>$null
if (-not $branchExists) {
    Write-Host "Remote branch 'netlify' does not exist. Exiting..." -ForegroundColor Yellow
    exit 0
}

# Check if there are differences - update if needed
git diff --quiet origin/netlify -- netlify.toml .netlify/ netlify/
if ($LASTEXITCODE -eq 0) {
    Write-Host "No Netlify update required." -ForegroundColor Green
}
else {
    Write-Host "Updating Netlify..." -ForegroundColor Yellow
    .\deployment\deploy-netlify.ps1
}

# run the website deployment. Changes are likely.
npm run deploy
