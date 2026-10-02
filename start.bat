@echo off
setlocal enabledelayedexpansion

title WatchParty Launcher
cd /d "%~dp0"

echo ====================================================================
echo   WatchParty - Real-Time YouTube Watch Party Launcher
echo ====================================================================
echo.

:: 1. Verify Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js v18.0.0 or higher from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Verify npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in your PATH.
    echo Please ensure npm is installed and added to PATH.
    echo.
    pause
    exit /b 1
)

:: 3. Setup environment files if missing
if not exist "server\.env" (
    if exist "server\.env.example" (
        echo [INFO] Creating server\.env from server\.env.example...
        copy "server\.env.example" "server\.env" >nul
    )
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)

:: 4. Verify node_modules
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

:: 5. Handle command-line arguments if passed directly
if /i "%~1"=="dev" goto do_dev
if /i "%~1"=="prod" goto do_prod
if /i "%~1"=="test" goto do_test
if /i "%~1"=="lint" goto do_lint
if /i "%~1"=="install" goto do_install
if /i "%~1"=="build" goto do_build
if /i "%~1"=="stop" goto do_stop

:: 6. Interactive Menu
echo Select an option:
echo   [1] Start Development Mode (Backend :3000 + Frontend :5173 with HMR) [DEFAULT]
echo   [2] Start Production Mode  (Build and run single server on :3000)
echo   [3] Run Automated Tests    (Vitest test suite)
echo   [4] Run Type Check and Lint (TypeScript verification)
echo   [5] Reinstall Dependencies (npm install)
echo   [6] Stop Running Servers   (Free ports 3000 and 5173)
echo   [7] Exit
echo.

choice /c 1234567 /t 5 /d 1 /m "Select option (defaulting to [1] in 5s): "
if errorlevel 7 goto do_exit
if errorlevel 6 goto do_stop
if errorlevel 5 goto do_install
if errorlevel 4 goto do_lint
if errorlevel 3 goto do_test
if errorlevel 2 goto do_prod
goto do_dev

:do_dev
echo.
echo ====================================================================
echo   Starting WatchParty in Development Mode...
echo ====================================================================
echo.

:: Check if port 3000 or 5173 already occupied
netstat -aon | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Port 3000 is already in use.
    echo If a previous server is running, close it or use option [6] to stop it.
)

netstat -aon | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Port 5173 is already in use.
    echo If a previous client is running, close it or use option [6] to stop it.
)

echo [INFO] Launching Backend Server on port 3000...
start "WatchParty - Backend [Port 3000]" cmd /k "cd /d \"%~dp0\" && title WatchParty Backend [Port 3000] && npm run dev:server"

echo [INFO] Launching Frontend Client on port 5173...
start "WatchParty - Frontend [Port 5173]" cmd /k "cd /d \"%~dp0\" && title WatchParty Frontend [Port 5173] && npm run dev:client"

echo [INFO] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul 2>&1 || ping -n 4 127.0.0.1 >nul

echo [INFO] Opening browser at http://localhost:5173...
start http://localhost:5173

echo.
echo ====================================================================
echo   WatchParty is up and running!
echo   - Web App UI:     http://localhost:5173
echo   - Backend Server: http://localhost:3000
echo   - Health Check:   http://localhost:3000/health
echo.
echo   Both services are running in separate terminal windows.
echo   - To stop the servers, close their terminal windows.
echo   - You can also run 'start.bat stop' to stop them.
echo   - Press any key to close this launcher window (servers keep running).
echo ====================================================================
echo.
pause
goto do_exit

:do_prod
echo.
echo ====================================================================
echo   Building and Starting in Production Mode...
echo ====================================================================
echo.
echo [INFO] Building client and server...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed. Please check errors above.
    pause
    goto do_exit
)

echo.
echo [INFO] Starting Production Server on port 3000...
echo [INFO] Opening browser at http://localhost:3000...
start http://localhost:3000
call npm start
goto do_exit

:do_build
echo.
echo [INFO] Running production build...
call npm run build
pause
goto do_exit

:do_test
echo.
echo [INFO] Running automated test suite...
call npm test
echo.
pause
goto do_exit

:do_lint
echo.
echo [INFO] Running type checking and linting...
call npm run lint
echo.
pause
goto do_exit

:do_install
echo.
echo [INFO] Installing dependencies...
call npm install
echo.
pause
goto do_exit

:do_stop
echo.
echo [INFO] Stopping any processes on port 3000 or 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo [INFO] Killing process on port 3000 - PID %%a
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo [INFO] Killing process on port 5173 - PID %%a
    taskkill /f /pid %%a >nul 2>&1
)
echo [INFO] Cleanup complete.
echo.
pause
goto do_exit

:do_exit
endlocal
exit /b 0
