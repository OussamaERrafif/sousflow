@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:menu
cls

echo.
echo    ::::::::   ::::::::  :::    :::  ::::::::   ::::::::  :::::::::: :::        ::::::::  :::       :::
echo   :+:    :+: :+:    :+: :+:    :+: :+:    :+: :+:    :+: :+:        :+:       :+:    :+: :+:       :+:
echo   +:+        +:+    +:+ +:+    +:+ +:+        +:+        +:+        +:+       +:+    +:+ +:+       +:+
echo   +#++:++#++ +#+    +:+ +#+    +:+ +#++:++#++ +#++:++#++ :#::+::#   +#+       +#+    +:+ +#+  +:+  +#+
echo          +#+ +#+    +#+ +#+    +#+        +#+        +#+ +#+        +#+       +#+    +#+ +#+ +#+#+ +#+
echo   #+#    #+# #+#    #+# #+#    #+# #+#    #+# #+#    #+# #+#        #+#       #+#    #+# #+#+# #+#+#
echo    ########   ########   ########   ########   ########  ###        ########## ########   ###   ###
echo.
echo   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
echo    *  Smart Irrigation Platform for Olive Farms  *  AI-Powered  *  Real-Time Monitoring  *  v2.0.0  *
echo   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
echo.
echo   +=========================================+============================================+
echo   ^|                     BACKEND  (Python / FastAPI)                                     ^|
echo   +=========================================+============================================+
echo   ^|  [1]  Activate Virtual Environment      ^|  [4]  Run Tests (pytest)                  ^|
echo   ^|  [2]  Install Dependencies              ^|  [5]  Run Lint  (black + isort)           ^|
echo   ^|  [3]  Run Backend Server                ^|  [6]  Run Type Check (mypy)               ^|
echo   +=========================================+============================================+
echo   ^|                     FRONTEND  (React / TypeScript)                                  ^|
echo   +=========================================+============================================+
echo   ^|  [7]  Install Dependencies              ^|  [10] Run Lint (ESLint)                   ^|
echo   ^|  [8]  Run Dev Server                    ^|  [11] Run Codegen (GraphQL)               ^|
echo   ^|  [9]  Build for Production              ^|  [A]  Run Backend + Frontend Together     ^|
echo   +=========================================+============================================+
echo   ^|                     LANDING PAGE  (Next.js)                                         ^|
echo   +=========================================+============================================+
echo   ^|  [12] Install Dependencies              ^|  [15] Run Lint                            ^|
echo   ^|  [13] Run Dev Server                    ^|  [16] Run All Lints (Full Check)          ^|
echo   ^|  [14] Build for Production              ^|  [17] Seed Database                       ^|
echo   +=========================================+============================================+
echo   ^|                     UTILITIES ^& EXTRAS                                              ^|
echo   +=========================================+============================================+
echo   ^|  [18] Open API Docs (Swagger UI)        ^|  [20] Generate .env Template              ^|
echo   ^|  [19] Run Docker Compose (Full Stack)   ^|  [21] Check System Requirements           ^|
echo   +=========================================+============================================+
echo.
echo   +-----------------------------------------------------------------------------------------+
echo   ^|          [ SOUSSFLOW SMART IRRIGATION SUITE ]                                          ^|
echo   ^|  Powered by AI  ^|  Souss-Massa Region  ^|  Sustainable Water Management               ^|
echo   +-----------------------------------------------------------------------------------------+
echo.
echo                                       [0]  Exit
echo.
echo   +=========================================================================================+
echo   ^|  TIP: Use [A] to launch both Backend ^& Frontend simultaneously for full dev experience ^|
echo   +=========================================================================================+
echo.

set /p choice="  Select option: "

if "%choice%"=="1" goto venv
if "%choice%"=="2" goto backend_install
if "%choice%"=="3" goto backend_run
if "%choice%"=="4" goto backend_test
if "%choice%"=="5" goto backend_lint
if "%choice%"=="6" goto backend_typecheck
if "%choice%"=="7" goto frontend_install
if "%choice%"=="8" goto frontend_run
if "%choice%"=="9" goto frontend_build
if "%choice%"=="10" goto frontend_lint
if "%choice%"=="11" goto frontend_codegen
if "%choice%"=="12" goto landingpage_install
if "%choice%"=="13" goto landingpage_run
if "%choice%"=="14" goto landingpage_build
if "%choice%"=="15" goto landingpage_lint
if "%choice%"=="16" goto all_lint
if "%choice%"=="17" goto seed_db
if /i "%choice%"=="A" goto run_both
if "%choice%"=="0" goto exit

color 0C
echo.
echo  [X] Invalid option! Please try again...
timeout /t 2 >nul
color 0A
goto menu

:venv
cls
color 0B
echo.
echo  [..] Activating Python Virtual Environment...
echo.
cd /d "%~dp0backend"
if exist "Scripts\activate.bat" (
    call Scripts\activate.bat
    echo  [OK] Virtual environment activated!
) else (
    echo  [!] Creating virtual environment...
    python -m venv Scripts
    call Scripts\activate.bat
    echo  [OK] Virtual environment created and activated!
)
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:backend_install
cls
color 0B
echo.
echo  [..] Installing Backend Dependencies...
echo.
cd /d "%~dp0backend"
call Scripts\activate.bat >nul 2>&1
pip install -r requirements.txt
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:backend_run
cls
color 0B
echo.
echo  [..] Starting Backend Server...
echo.
cd /d "%~dp0backend"
if not defined VIRTUAL_ENV (
    echo  [..] Activating virtual environment...
    call Scripts\activate.bat
) else (
    echo  [OK] Virtual environment already activated.
)
echo.
python main.py
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:backend_test
cls
color 0B
echo.
echo  [..] Running Backend Tests...
echo.
cd /d "%~dp0backend"
call Scripts\activate.bat >nul 2>&1
pytest
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:backend_lint
cls
color 0B
echo.
echo  [..] Running Backend Lint...
echo.
cd /d "%~dp0backend"
call Scripts\activate.bat >nul 2>&1
echo   - Running black...
black .
echo   - Running isort...
isort .
echo   - Running flake8...
flake8
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:backend_typecheck
cls
color 0B
echo.
echo  [..] Running Backend Type Check...
echo.
cd /d "%~dp0backend"
call Scripts\activate.bat >nul 2>&1
mypy .
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:frontend_install
cls
color 0E
echo.
echo  [..] Installing Frontend Dependencies...
echo.
cd /d "%~dp0frontend"
call npm install
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:frontend_run
cls
color 0E
echo.
echo  [..] Starting Frontend Dev Server...
echo.
cd /d "%~dp0frontend"
call npm run dev
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:frontend_build
cls
color 0E
echo.
echo  [..] Building Frontend...
echo.
cd /d "%~dp0frontend"
call npm run build
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:frontend_lint
cls
color 0E
echo.
echo  [..] Running Frontend Lint...
echo.
cd /d "%~dp0frontend"
call npm run lint
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:frontend_codegen
cls
color 0E
echo.
echo  [..] Running Frontend Codegen...
echo.
cd /d "%~dp0frontend"
call npm run codegen
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:landingpage_install
cls
color 0D
echo.
echo  [..] Installing Landingpage Dependencies...
echo.
cd /d "%~dp0landingpage"
call npm install
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:landingpage_run
cls
color 0D
echo.
echo  [..] Starting Landingpage Dev Server...
echo.
cd /d "%~dp0landingpage"
call npm run dev
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:landingpage_build
cls
color 0D
echo.
echo  [..] Building Landingpage...
echo.
cd /d "%~dp0landingpage"
call npm run build
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:landingpage_lint
cls
color 0D
echo.
echo  [..] Running Landingpage Lint...
echo.
cd /d "%~dp0landingpage"
call npm run lint
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:all_lint
cls
color 0C
echo.
echo  [..] Running All Lints...
echo.
echo  +--- Backend Lint ---+
cd /d "%~dp0backend"
call Scripts\activate.bat >nul 2>&1
black . && isort . && flake8
echo.
echo  +--- Frontend Lint ---+
cd /d "%~dp0frontend"
call npm run lint
echo.
echo  +--- Landingpage Lint ---+
cd /d "%~dp0landingpage"
call npm run lint
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:seed_db
cls
color 0B
echo.
echo  [..] Seeding Database...
echo.
cd /d "%~dp0backend"
call Scripts\activate.bat >nul 2>&1
python -c "from app.database import supabase; print('[OK] Database connection test - check if Supabase is configured')"
echo.
echo  [!] Note: Run SQL seed file manually in Supabase dashboard for full seeding.
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:run_both
cls
color 0A
echo.
echo  [..] Starting Backend and Frontend Servers...
echo.
cd /d "%~dp0backend"
start "Backend Server (Port 8000)" cmd /k "cd /d "%~dp0backend" && call Scripts\activate.bat && python main.py"

cd /d "%~dp0frontend"
start "Frontend Server (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  [OK] Both servers started in separate windows:
echo       - Backend:   http://localhost:8000
echo       - Frontend:  http://localhost:3000
echo.
echo  Press any key to return to menu...
pause >nul
goto menu

:exit
color 0F
exit /b 0
