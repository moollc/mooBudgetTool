@echo off
REM Always run from mBT/ root regardless of where this script is launched from
cd /d "%~dp0.."

echo ============================================
echo    mBT Portable Bundle Script
echo ============================================
echo.

set "OUTPUT_DIR=dist"
set "ENTRY_FILE=index.html"
set "SRC_DIR=src"
set "PUBLIC_DIR=public"

REM Create clean output directory
if exist "%OUTPUT_DIR%" (
    rmdir /s /q "%OUTPUT_DIR%"
)
mkdir "%OUTPUT_DIR%"
echo [OK] Created output directory: %OUTPUT_DIR%
echo.

REM Copy main entry HTML
if exist "%ENTRY_FILE%" (
    copy "%ENTRY_FILE%" "%OUTPUT_DIR%\%ENTRY_FILE%" >nul
    echo [OK] Copied %ENTRY_FILE%
) else (
    echo [ERROR] %ENTRY_FILE% not found!
    pause
    exit /b 1
)

REM Copy entire src folder tree (core, scripts, tools, services, config, lib, template)
if exist "%SRC_DIR%" (
    robocopy "%SRC_DIR%" "%OUTPUT_DIR%\src" /E /NFL /NDL /NC /NS /NP /NJH /NJS
    echo [OK] Copied src/ (full tree)
)

REM Copy entire public folder tree
if exist "%PUBLIC_DIR%" (
    robocopy "%PUBLIC_DIR%" "%OUTPUT_DIR%\public" /E /NFL /NDL /NC /NS /NP /NJH /NJS
    echo [OK] Copied public/
)

REM Copy root assets
if exist "manifest.json" (
    copy "manifest.json" "%OUTPUT_DIR%\manifest.json" >nul
    echo [OK] Copied manifest.json
)
if exist "metadata.json" (
    copy "metadata.json" "%OUTPUT_DIR%\metadata.json" >nul
    echo [OK] Copied metadata.json
)
if exist "README_USER.md" (
    copy "README_USER.md" "%OUTPUT_DIR%\README_USER.md" >nul
    echo [OK] Copied README_USER.md
)
if exist "cow-maskable.svg" (
    copy "cow-maskable.svg" "%OUTPUT_DIR%\cow-maskable.svg" >nul
    echo [OK] Copied cow-maskable.svg
)
if exist "sw.js" (
    copy "sw.js" "%OUTPUT_DIR%\sw.js" >nul
    echo [OK] Copied sw.js
)

echo.
echo ============================================
echo    Verifying Distribution
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
    if exist %%F (
        echo   [OK] %%~F
    ) else (
        echo   [MISSING] %%~F
        set "ALL_GOOD=0"
    )
)

echo.
echo ============================================
echo    Bundle Complete!
echo ============================================
echo.
echo Output: %OUTPUT_DIR%\%ENTRY_FILE%
echo.
echo To run:
echo   1. Double-click dist/%ENTRY_FILE%
echo   2. Or open via file:// protocol
echo.
pause
