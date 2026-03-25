@echo off
REM Always run from the root repository level
cd /d "%~dp0"

echo ============================================
echo    mBT Portable Bundle Script (External)
echo ============================================
echo.

set "OUTPUT_DIR=mooBudgetTool-dist"
set "SRC_REPO=mBT"
set "ENTRY_FILE=index.html"

REM Create clean output directory
if exist "%OUTPUT_DIR%" (
    rmdir /s /q "%OUTPUT_DIR%"
)
mkdir "%OUTPUT_DIR%"
echo [OK] Created output directory: %OUTPUT_DIR%
echo.

REM Copy main entry HTML
if exist "%SRC_REPO%\%ENTRY_FILE%" (
    copy "%SRC_REPO%\%ENTRY_FILE%" "%OUTPUT_DIR%\%ENTRY_FILE%" >nul
    echo [OK] Copied %ENTRY_FILE%
) else (
    echo [ERROR] %ENTRY_FILE% not found in %SRC_REPO%!
    pause
    exit /b 1
)

REM Copy entire src folder tree
if exist "%SRC_REPO%\src" (
    robocopy "%SRC_REPO%\src" "%OUTPUT_DIR%\src" /E /NFL /NDL /NC /NS /NP /NJH /NJS
    echo [OK] Copied src/ (full tree)
)

REM Copy entire public folder tree
if exist "%SRC_REPO%\public" (
    robocopy "%SRC_REPO%\public" "%OUTPUT_DIR%\public" /E /NFL /NDL /NC /NS /NP /NJH /NJS
    echo [OK] Copied public/
)

REM Copy entire assets folder tree
if exist "%SRC_REPO%\assets" (
    robocopy "%SRC_REPO%\assets" "%OUTPUT_DIR%\assets" /E /NFL /NDL /NC /NS /NP /NJH /NJS
    echo [OK] Copied assets/
)

REM Copy root assets safely
for %%F in (manifest.json metadata.json README_USER.md cow-maskable.svg sw.js) do (
    if exist "%SRC_REPO%\%%F" (
        copy "%SRC_REPO%\%%F" "%OUTPUT_DIR%\%%F" >nul
        echo [OK] Copied %%F
    )
)

echo.
echo ============================================
echo    Verifying External Distribution
echo ============================================

REM Check critical files exist
set "ALL_GOOD=1"
for %%F in (
    "%OUTPUT_DIR%\index.html"
    "%OUTPUT_DIR%\src\scripts\storage.js"
    "%OUTPUT_DIR%\src\scripts\engine\mbtle.js"
    "%OUTPUT_DIR%\src\core\mBT.core.js"
    "%OUTPUT_DIR%\manifest.json"
) do (
    if exist "%%~F" (
        echo   [OK] %%~F
    ) else (
        echo   [MISSING] %%~F
        set "ALL_GOOD=0"
    )
)

echo.
echo ============================================
echo    Pushing mBT to Git Repository...
echo ============================================
echo.
cd /d "%~dp0"
setlocal enabledelayedexpansion
set "AI_MSG=revived the wise and quickbooks csv export engines, implemented network-first pwa navigation routing, and hardened offline stability by localizing assets"
for /f "usebackq delims=" %%I in (`powershell -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic'); $msg = [Microsoft.VisualBasic.Interaction]::InputBox('Edit Commit Summary', 'mBT GitPrep', '!AI_MSG!'); if($msg) { $msg } else { '!AI_MSG!' }"`) do set "FINAL_MSG=%%I"
if "!FINAL_MSG!"=="" set "FINAL_MSG=!AI_MSG!"
git --git-dir=mBT/.git --work-tree=. add mBT/ bundle.bat
git --git-dir=mBT/.git --work-tree=. commit -m "!FINAL_MSG!"
git --git-dir=mBT/.git --work-tree=. push origin HEAD
endlocal

echo.
echo ============================================
echo    All clear! Bundle deployed.
echo ============================================
echo To run locally:
echo   1. Double-click %OUTPUT_DIR%\%ENTRY_FILE%
echo   2. Or open via file:// protocol
echo.

cd /d "%~dp0"
set /p DELETE_CONFIRM="Do you want to delete the local distribution folder (%OUTPUT_DIR%)? (Y/N): "
if /I "%DELETE_CONFIRM%"=="Y" (
    rmdir /s /q "%OUTPUT_DIR%"
    echo [OK] Removed %OUTPUT_DIR%.
) else (
    echo Keeping %OUTPUT_DIR% for local testing.
)

echo.
pause
