@echo off
setlocal
cd /d "%~dp0"

rem Explicitly point tsx at the simulator config. This is important on Windows:
rem the root project uses TypeScript project references, while runtime aliases live
rem in the simulator config.
set "TSX_TSCONFIG_PATH=%CD%\tsconfig.simulation.json"

echo ========================================
echo  Koren Zhivoznaniya - Balance Simulator
echo ========================================
echo.

where node >nul 2>nul || (
  echo [ERROR] Node.js not found. Install Node.js 22+ first.
  pause
  exit /b 1
)

if not exist node_modules\tsx (
  echo Installing project dependencies once...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo Running 250 campaigns. This may take a little while...
call npm run simulate
if errorlevel 1 (
  echo.
  echo [ERROR] Simulation failed.
  echo.
  echo Try this diagnostic command in the same folder:
  echo npm run simulate:quick
  pause
  exit /b 1
)

echo.
echo Results are in simulation-results\
if exist simulation-results\latest-summary.md start "" notepad simulation-results\latest-summary.md

echo.
pause
