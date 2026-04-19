@echo off
cd /d "%~dp0backend"
echo Starting Flashcard API on http://localhost:8000
set "PYTHON_EXE=C:\Users\Sandbox\AppData\Local\Programs\Python\Python314\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"
"%PYTHON_EXE%" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
