@echo off
setlocal enabledelayedexpansion
set "AI_MSG=added multiplayer share link modal and live cursor locking plus undo history"
echo Auto-Summary: %AI_MSG%
set /p "USER_MSG=Add description (optional): "
if "%USER_MSG%"=="" (set "FINAL_MSG=%AI_MSG%") else (set "FINAL_MSG=%AI_MSG% - %USER_MSG%")
git add .
git commit -m "!FINAL_MSG!"
git push
echo Done.
pause
