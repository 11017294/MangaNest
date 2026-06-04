@echo off
cd /d "D:\item\MangaNest\backend"

echo Starting Backend Server (Port 3001)...
start "ImageBrowser-Backend" cmd /k "node server.js"




cd /d "D:\item\MangaNest\frontend"
echo Starting Frontend Dev Server (Port 3000)...
start "ImageBrowser-Frontend" cmd /k "npm run dev"

echo Services started!
timeout /t 3
