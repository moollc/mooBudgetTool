# mBT Portable Bundle Script (Windows PowerShell)
# Creates a standalone dist/ folder ready for distribution

# Always run from mBT/ root regardless of where this script is launched from
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent)

$OutputDir = "dist"
$EntryFile = "index.html"
$SrcDir = "src"
$PublicDir = "public"

# Create clean output directory
if (Test-Path $OutputDir) {
    Remove-Item $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Copy main entry HTML
if (Test-Path $EntryFile) {
    Copy-Item $EntryFile -Destination $OutputDir -Force
    Write-Host "[OK] Copied $EntryFile" -ForegroundColor Green
} else {
    Write-Host "[ERROR] $EntryFile not found!" -ForegroundColor Red
    exit 1
}

# Copy entire src folder (preserving directory structure)
if (Test-Path $SrcDir) {
    Copy-Item $SrcDir -Destination $OutputDir -Recurse -Force
    Write-Host "[OK] Copied $SrcDir/ (full tree)" -ForegroundColor Green
}

# Copy entire public folder
if (Test-Path $PublicDir) {
    Copy-Item $PublicDir -Destination $OutputDir -Recurse -Force
    Write-Host "[OK] Copied $PublicDir/" -ForegroundColor Green
}

# Copy root manifest
if (Test-Path "manifest.json") {
    Copy-Item "manifest.json" -Destination $OutputDir -Force
    Write-Host "[OK] Copied manifest.json" -ForegroundColor Green
}

# Copy metadata
if (Test-Path "metadata.json") {
    Copy-Item "metadata.json" -Destination $OutputDir -Force
    Write-Host "[OK] Copied metadata.json" -ForegroundColor Green
}

# Copy user documentation
if (Test-Path "README_USER.md") {
    Copy-Item "README_USER.md" -Destination $OutputDir -Force
    Write-Host "[OK] Copied README_USER.md" -ForegroundColor Green
}

# Copy SVG icon
if (Test-Path "cow-maskable.svg") {
    Copy-Item "cow-maskable.svg" -Destination $OutputDir -Force
    Write-Host "[OK] Copied cow-maskable.svg" -ForegroundColor Green
}

# Copy service worker (must be at root alongside index.html for correct SW scope)
if (Test-Path "sw.js") {
    Copy-Item "sw.js" -Destination $OutputDir -Force
    Write-Host "[OK] Copied sw.js" -ForegroundColor Green
}

# Exclude development-only files from dist
$devFiles = @("mBT-Old.html", "README.md", "walkthrough.md", ".env.example", ".gitignore", "_phase16_patch.ps1")
foreach ($f in $devFiles) {
    $path = Join-Path $OutputDir $f
    if (Test-Path $path) {
        Remove-Item $path -Force
    }
}

# Verify critical paths exist in dist
Write-Host ""
Write-Host "=== Verifying Distribution ===" -ForegroundColor Cyan
$criticalPaths = @(
    "$OutputDir\index.html",
    "$OutputDir\sw.js",
    "$OutputDir\src\scripts\storage.js",
    "$OutputDir\src\scripts\engine\mbtle.js",
    "$OutputDir\src\core\mBT.core.js",
    "$OutputDir\src\lib\localforage.min.js",
    "$OutputDir\src\tools\db\index.html",
    "$OutputDir\src\tools\stages\index.html",
    "$OutputDir\src\tools\publisher\index.html",
    "$OutputDir\manifest.json"
)

$allGood = $true
foreach ($p in $criticalPaths) {
    if (Test-Path $p) {
        Write-Host "  [OK] $p" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $p" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""
if ($allGood) {
    Write-Host "=== mBT Portable Bundle Complete ===" -ForegroundColor Green
} else {
    Write-Host "=== Bundle Complete (with warnings) ===" -ForegroundColor Yellow
}
Write-Host "Output: $OutputDir\$EntryFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run:" -ForegroundColor Yellow
Write-Host "  1. Double-click $OutputDir\$EntryFile" -ForegroundColor White
Write-Host "  2. Or open in browser via file:// protocol" -ForegroundColor White
