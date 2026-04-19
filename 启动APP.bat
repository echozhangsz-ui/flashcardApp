@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "MOBILE=%ROOT%mobile"
set "PYTHON_EXE=C:\Users\Sandbox\AppData\Local\Programs\Python\Python314\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

:: Request admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Open firewall ports (first run only)
netsh advfirewall firewall show rule name="Expo Dev" >nul 2>&1
if %errorLevel% neq 0 (
    netsh advfirewall firewall add rule name="Expo Dev" dir=in action=allow protocol=TCP localport=8081 >nul
    netsh advfirewall firewall add rule name="Flashcard API" dir=in action=allow protocol=TCP localport=8000 >nul
    echo [OK] Firewall ports opened
)

:: Load API key from .env
for /f "tokens=1,2 delims==" %%a in (%BACKEND%\.env) do set "%%a=%%b"

:: Delete stale backend URL file
if exist "%MOBILE%\backend_url.txt" del "%MOBILE%\backend_url.txt"

:: Kill old Python backends on port 8000 to avoid connecting to stale code
for /f "tokens=5" %%p in ('netstat -ano ^| findstr LISTENING ^| findstr :8000') do (
    for /f "tokens=1,* delims=," %%a in ('tasklist /FI "PID eq %%p" /FO CSV /NH') do (
        echo %%~a | findstr /I "python.exe" >nul && (
            taskkill /PID %%p /F >nul 2>&1
        )
    )
)

timeout /t 1 /nobreak >nul

:: Start backend
start "Backend" cmd /k "cd /d "%BACKEND%" && set OPENAI_API_KEY=%OPENAI_API_KEY% && "%PYTHON_EXE%" -m uvicorn main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

:: Start backend HTTPS tunnel
start "Backend Tunnel" cmd /k "cd /d "%ROOT%" && node tunnel_backend.js"

:: Wait until backend_url.txt is written (max 60s)
echo Waiting for backend tunnel...
set /a count=0
:wait_tunnel
if exist "%MOBILE%\backend_url.txt" goto tunnel_ready
if %count% GEQ 30 goto tunnel_timeout
timeout /t 2 /nobreak >nul
set /a count+=1
goto wait_tunnel

:tunnel_ready
echo [OK] Backend tunnel ready
goto start_expo

:tunnel_timeout
echo [WARN] Tunnel not ready, starting Expo anyway

:start_expo
:: Start Expo - scan QR code in this window
start "Expo QR" cmd /k "cd /d "%MOBILE%" && npx expo start --lan"

echo [OK] All services started. Scan QR code in the Expo window.
pause
