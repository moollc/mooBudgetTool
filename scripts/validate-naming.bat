@echo off
:: mBT Naming Convention Validator
:: Checks that all tool HTML files expose an mBT-prefixed namespace object
REM Always run from mBT/ root regardless of where this script is launched from
cd /d "%~dp0.."

setlocal enabledelayedexpansion
set PASS=0
set FAIL=0
set WARN=0

echo.
echo ========================================
echo  mBT Naming Convention Check
echo ========================================
echo.

for /r "src\tools" %%f in (index.html) do (
    set "FILE=%%f"
    set "RELFILE=%%f"

    :: Check for mBT-prefixed var declaration
    findstr /c:"var mBT" "%%f" >nul 2>&1
    if !errorlevel! == 0 (
        for /f "tokens=*" %%l in ('findstr /c:"var mBT" "%%f"') do (
            echo [PASS] %%~pf - Found: %%l
        )
        set /a PASS+=1
    ) else (
        :: Check if it has any var declaration at all
        findstr /c:"var [A-Z]" "%%f" >nul 2>&1
        if !errorlevel! == 0 (
            for /f "tokens=*" %%l in ('findstr /rn /c:"^var [A-Z]" "%%f" 2^>nul') do (
                echo [FAIL] %%~pf - Non-mBT namespace: %%l
            )
            set /a FAIL+=1
        ) else (
            echo [WARN] %%~pf - No named namespace object found
            set /a WARN+=1
        )
    )
)

echo.
echo ========================================
echo  Results: %PASS% pass, %FAIL% fail, %WARN% warn
echo ========================================
echo.

if %FAIL% GTR 0 (
    echo VIOLATIONS FOUND. Rename namespace objects to use mBT prefix.
    echo Example: var CAL = ... should be var mBTCalendar = ...
    echo.
    exit /b 1
)

if %WARN% GTR 0 (
    echo Warnings: Some tool files have no named namespace.
    echo Consider wrapping inline functions in an mBT-prefixed object.
)

echo All named namespaces follow mBT convention.
exit /b 0
