@echo off
REM Read-only: shows what schedules the agent has and whether they're active NOW.
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "DIR=C:\ProgramData\Git1"
echo === Agent commit ===
git -C "%DIR%" log --oneline -1
echo.
echo === GIT1_CHILD_USER the agent enforces on ===
"%DIR%\agent\.bin\nssm.exe" get Git1Agent AppEnvironmentExtra 2>nul | findstr /i "CHILD_USER"
echo.
echo === Who is actually at the console right now ===
quser 2>nul
echo.
echo === What schedules does the agent have + are they active NOW ===
"C:\Program Files\Python312\python.exe" -c "import sys; sys.path.insert(0, r'%DIR%\agent'); import json, datetime as dt; from pathlib import Path; p=Path(r'%DIR%\agent'); import importlib.util as u; spec=u.spec_from_file_location('es', r'%DIR%\agent\enforcer_schedule.py'); es=u.module_from_spec(spec); spec.loader.exec_module(es); pol=Path.home(); import os; cfgdir=Path(os.environ.get('APPDATA', r'C:\Windows\System32\config\systemprofile\AppData\Roaming'))/'Git1'; f=cfgdir/'policy.json'; print('policy file:', f, 'exists=', f.exists()); data=json.loads(f.read_text()) if f.exists() else {}; sch=data.get('schedules') or []; print('schedules count:', len(sch)); [print('  -', s.get('name'), s.get('days'), s.get('startMinute'),'-',s.get('endMinute'), s.get('actions'), 'enabled=',s.get('enabled')) for s in sch]; es.set_schedules(sch); now=dt.datetime.now(); print('now =', now.strftime('%%a %%H:%%M')); print('ACTIVE ACTIONS NOW:', es.active_actions(now))"
echo.
echo === Last 15 log lines ===
powershell -NoProfile -Command "Get-Content '%DIR%\agent\agent.log' -Tail 15"
pause
