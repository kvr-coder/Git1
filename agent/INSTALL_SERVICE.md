# Install the Git1 agent as a Windows Service

Running the agent as a service (rather than a console script) means:
- It starts at boot, before any user logs in
- The kid (running as Standard User) cannot kill it from Task Manager
- It survives logout

We use [NSSM](https://nssm.cc/) — the Non-Sucking Service Manager.

## One-time setup (do as Administrator)

1. Download NSSM: https://nssm.cc/download → unzip → copy `nssm.exe` to `C:\Windows\System32`.
2. Open **PowerShell as Administrator**.
3. Find the full path to your Python:
   ```
   where.exe python
   ```
   Note the result, e.g. `C:\Users\Kvara\AppData\Local\Programs\Python\Python311\python.exe`.

4. Install the service:
   ```
   nssm install Git1Agent "C:\Users\Kvara\AppData\Local\Programs\Python\Python311\python.exe" "C:\Users\Kvara\Git1\agent\agent.py"
   nssm set Git1Agent AppDirectory "C:\Users\Kvara\Git1\agent"
   nssm set Git1Agent AppStdout    "C:\Users\Kvara\Git1\agent\agent.log"
   nssm set Git1Agent AppStderr    "C:\Users\Kvara\Git1\agent\agent.log"
   nssm set Git1Agent AppEnvironmentExtra "GIT1_SERVER=http://192.168.1.42:8080"
   nssm set Git1Agent Start SERVICE_AUTO_START
   nssm start Git1Agent
   ```
   (Replace the IP with your server's LAN IP.)

5. Verify:
   ```
   sc query Git1Agent
   ```
   You should see `STATE: 4 RUNNING`.

## Pairing a service install

The first time the service runs without an `agent.json`, it will print a pairing
code to `agent.log`. View it:
```
Get-Content C:\Users\Kvara\Git1\agent\agent.log -Wait
```
Enter the 6-digit code in the mobile app, then `nssm restart Git1Agent`.

## Updating the agent
After `git pull`:
```
nssm restart Git1Agent
```

## Uninstalling
```
nssm stop Git1Agent
nssm remove Git1Agent confirm
```

## Why "LocalSystem" and not the kid's account?
NSSM defaults to running as `LocalSystem`, which has the highest privilege.
That is what you want for parental controls — the kid (Standard User) cannot
stop or modify it. `LockWorkStation` from `LocalSystem` locks the **active
session**, which is the kid's, so it works as expected.
