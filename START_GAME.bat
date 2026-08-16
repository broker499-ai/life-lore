@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Корень Живознания

echo ========================================
echo        КОРЕНЬ ЖИВОЗНАНИЯ - ЗАПУСК
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :NO_NODE

where npm >nul 2>nul
if errorlevel 1 goto :NO_NODE

echo Node.js:
node --version
echo.

node -e "const v=process.versions.node.split('.').map(Number); const ok=v[0] > 22 || (v[0] === 22 && v[1] >= 12) || (v[0] === 20 && v[1] >= 19); process.exit(ok ? 0 : 1)" >nul 2>nul
if errorlevel 1 goto :OLD_NODE

if not exist "package.json" (
  echo [ОШИБКА] package.json не найден рядом с START_GAME.bat.
  echo Не переносите BAT отдельно от папки игры.
  pause
  exit /b 1
)

if not exist "node_modules\vite\package.json" (
  echo Первый запуск: устанавливаю зависимости...
  echo Для этого шага требуется интернет.
  echo.
  call npm install
  if errorlevel 1 goto :INSTALL_FAILED
  echo.
  echo Зависимости установлены.
  echo.
)

echo Запускаю игру: http://localhost:5173
echo Браузер откроется автоматически.
echo Чтобы остановить игру, закройте это окно или нажмите Ctrl+C.
echo.
call npm run dev:local

if errorlevel 1 (
  echo.
  echo [ОШИБКА] Сервер не запустился.
  echo Если порт 5173 занят, закройте другую локальную копию игры и попробуйте снова.
  pause
)
exit /b %errorlevel%

:OLD_NODE
echo [ОШИБКА] Версия Node.js слишком старая для текущего Vite.
echo Нужен Node.js 20.19+ или 22.12+ ^(либо более новая версия^).
echo Сейчас откроется официальный сайт Node.js.
start "" "https://nodejs.org/"
pause
exit /b 1

:NO_NODE
echo [ОШИБКА] Node.js / npm не найдены.
echo Установите актуальную LTS-версию Node.js, затем снова запустите START_GAME.bat.
echo Сейчас откроется официальный сайт Node.js.
start "" "https://nodejs.org/"
pause
exit /b 1

:INSTALL_FAILED
echo.
echo [ОШИБКА] npm install завершился с ошибкой.
echo Проверьте интернет-соединение и повторите запуск BAT.
pause
exit /b 1
