@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo Nursing Portal - Upload Update to GitHub
echo ==========================================
echo.

git status --short > "%TEMP%\nursing_portal_git_status.txt"
for %%A in ("%TEMP%\nursing_portal_git_status.txt") do if %%~zA==0 (
    del "%TEMP%\nursing_portal_git_status.txt" >nul 2>&1
    echo No new changes found.
    echo.
    echo If you edited lectures, make sure you saved them from:
    echo http://localhost:8000/admin.html
    echo.
    pause
    exit /b 0
)
del "%TEMP%\nursing_portal_git_status.txt" >nul 2>&1

echo Preparing files...
git add .
if errorlevel 1 goto error

echo Saving update...
git commit -m "Update nursing portal"
if errorlevel 1 goto error

echo Getting latest GitHub changes before upload...
git pull --rebase origin main
if errorlevel 1 goto rebase_error

echo Uploading to GitHub...
git push
if errorlevel 1 goto error

echo.
echo Done. GitHub Pages may take a minute to refresh.
echo Student site:
echo https://abanoub-sameh.github.io/Nursing_Portal/
echo.
pause
exit /b 0

:error
echo.
echo Upload failed.
echo Check your internet connection and GitHub sign-in, then try again.
echo.
pause
exit /b 1

:rebase_error
echo.
echo Upload paused because GitHub has changes that need merging.
echo This can happen if you edited from mobile and computer at the same time.
echo Send a screenshot of this window and I will fix it with you.
echo.
pause
exit /b 1
