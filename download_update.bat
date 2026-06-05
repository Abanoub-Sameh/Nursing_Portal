@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo Nursing Portal - Download Latest GitHub Update
echo ==========================================
echo.

git status --short > "%TEMP%\nursing_portal_local_status.txt" 2>nul
if errorlevel 1 goto error

for %%A in ("%TEMP%\nursing_portal_local_status.txt") do if not %%~zA==0 (
    del "%TEMP%\nursing_portal_local_status.txt" >nul 2>&1
    echo Local changes found.
    echo.
    echo To protect your edits, download is stopped.
    echo Upload your local changes first with upload_update.bat,
    echo then run this file again.
    echo.
    pause
    exit /b 1
)
del "%TEMP%\nursing_portal_local_status.txt" >nul 2>&1

echo Downloading latest version from GitHub...
git pull --ff-only origin main
if errorlevel 1 goto error

echo.
echo Done. Your computer now has the latest GitHub version.
echo.
pause
exit /b 0

:error
echo.
echo Download failed.
echo Check your internet connection and GitHub sign-in, then try again.
echo.
pause
exit /b 1
