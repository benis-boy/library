@echo off
echo Compiling TypeScript...
call tsc
if %errorlevel% neq 0 (
    echo TypeScript compilation failed.
    pause
    exit /b
)

echo Starting Python HTTP server...
start "" /B python -m http.server 8000

echo Opening browser...
timeout /t 2 >nul
start http://localhost:8000
