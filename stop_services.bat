@echo off
echo Stopping services...

:: Find and kill by window title
taskkill /F /FI "WINDOWTITLE eq ImageBrowser-Backend*" /T
taskkill /F /FI "WINDOWTITLE eq ImageBrowser-Frontend*" /T

echo Services stopped!
pause
