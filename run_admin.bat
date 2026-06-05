@echo off
setlocal
title Nursing Portal Admin
cd /d "%~dp0"
cls

echo ==========================================
echo Nursing Portal - Local Admin
echo ==========================================
echo.

echo [1/4] Checking Python...
where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo Python was not found on this computer.
    echo Install Python from:
    echo https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo [2/4] Checking for unsaved local changes...
git status --short > "%TEMP%\nursing_portal_local_status.txt" 2>nul
if errorlevel 1 (
    del "%TEMP%\nursing_portal_local_status.txt" >nul 2>&1
    echo Git is not ready here. Starting local admin without online sync.
    goto start_server
)

for %%A in ("%TEMP%\nursing_portal_local_status.txt") do if not %%~zA==0 (
    del "%TEMP%\nursing_portal_local_status.txt" >nul 2>&1
    echo.
    echo Local changes found.
    echo To avoid overwriting your work, I will NOT download from GitHub now.
    echo First upload your local changes with upload_update.bat, or finish the current work.
    echo.
    pause
    goto start_server
)
del "%TEMP%\nursing_portal_local_status.txt" >nul 2>&1

echo [3/4] Downloading latest GitHub version...
git pull --ff-only origin main
if errorlevel 1 (
    echo.
    echo Could not download latest GitHub version.
    echo This may be internet, GitHub sign-in, or a conflict.
    echo Starting local admin anyway, but be careful if you edited from mobile.
    echo.
    pause
)

:start_server
echo [4/4] Starting admin server...
echo.
echo Admin page:
echo http://localhost:8000/admin.html
echo.
echo Student page:
echo http://localhost:8000/index.html
echo.
echo IMPORTANT:
echo Keep this window open while using admin.
echo After editing, run upload_update.bat to publish online.
echo.

start "" http://localhost:8000/admin.html
python server.py

pause
