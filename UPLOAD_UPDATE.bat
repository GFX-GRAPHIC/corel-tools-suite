@echo off
title Upload Update Corel Tools Suite ke GitHub
color 0B
cls
echo ================================================================
echo   COREL TOOLS SUITE - ONE-CLICK AUTO PUBLISHER TO GITHUB
echo ================================================================
echo.

cd /d "%~dp0"

if exist "publish\uploader.js" (
    node publish\uploader.js
) else if exist "uploader.js" (
    node uploader.js
) else (
    echo [ERROR] File uploader.js tidak ditemukan!
)

echo.
echo Tekan tombol apa saja untuk menutup jendela ini...
pause >nul
