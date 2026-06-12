@echo off
REM ============================================================
REM  Git1 — Kid PC setup (SELF-CONTAINED single file).
REM  Double-click this on the CHILD's PC.
REM  Embeds Install-Git1-Kid.ps1 as base64; extracts to %TEMP%
REM  and runs it. Works on a fully offline PC AND with a private
REM  GitHub repo (no separate .ps1 file needed).
REM
REM  Optional: edit the values below before running.
REM ============================================================
setlocal EnableExtensions
set "GIT1_SERVER=https://git1-server.onrender.com"
set "CHILD_USER=Kiddo"
set "BRANCH=claude/setup-git1-dev-environment-QeNdU"

REM --- self-elevate ---
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  echo Requesting Administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "PS1_B64=%TEMP%\Install-Git1-Kid.ps1.b64"
set "PS1=%TEMP%\Install-Git1-Kid.ps1"
if exist "%PS1_B64%" del "%PS1_B64%"
if exist "%PS1%" del "%PS1%"

echo Extracting embedded installer...
>>"%PS1_B64%" echo PCMKICBJbnN0YWxsLUdpdDEtS2lkLnBzMSDigJQgc2V0IHVwIHRoZSBHaXQxIGFnZW50IG9uIGEg
>>"%PS1_B64%" echo Q0hJTEQncyBXaW5kb3dzIFBDLgoKICBSdW4gb25jZSAodGhlIC5iYXQgd3JhcHBlciBzZWxmLWVs
>>"%PS1_B64%" echo ZXZhdGVzIHRvIEFkbWluaXN0cmF0b3IpLiBGcm9tIHplcm8gaXQ6CiAgICAxLiBlbnN1cmVzIFB5
>>"%PS1_B64%" echo dGhvbiAzICsgR2l0IGFyZSBpbnN0YWxsZWQgKHZpYSB3aW5nZXQgaWYgbWlzc2luZykKICAgIDIu
>>"%PS1_B64%" echo IGNsb25lcyB0aGUgcmVwbyB0byBhIHByb3RlY3RlZCBsb2NhdGlvbiB0aGUga2lkIGNhbid0IGVk
>>"%PS1_B64%" echo aXQKICAgIDMuIGluc3RhbGxzIHRoZSBhZ2VudCdzIFB5dGhvbiBkZXBlbmRlbmNpZXMKICAgIDQu
>>"%PS1_B64%" echo IGNyZWF0ZXMgYSBkZWRpY2F0ZWQgU1RBTkRBUkQgKG5vbi1hZG1pbikgYWNjb3VudCBmb3IgdGhl
>>"%PS1_B64%" echo IGNoaWxkCiAgICA1LiBpbnN0YWxscyB0aGUgaGFyZGVuZWQgTG9jYWxTeXN0ZW0gc2VydmljZSAr
>>"%PS1_B64%" echo IHdhdGNoZG9nIChpbnN0YWxsLXNlcnZpY2UucHMxKQogICAgNi4gc3RhcnRzIGl0IGFuZCBzaG93
>>"%PS1_B64%" echo cyB0aGUgcGFpcmluZyBjb2RlIHRvIGVudGVyIGluIHRoZSBwYXJlbnQgYXBwCgogIFBsYWluIHNj
>>"%PS1_B64%" echo cmlwdCAobm8gcGFja2VkIC5leGUpIHNvIGFudGl2aXJ1cyBkb2Vzbid0IHF1YXJhbnRpbmUgaXQs
>>"%PS1_B64%" echo IGFuZCBzbyB0aGUKICBhZ2VudCBzdGF5cyBhIGdpdCBjaGVja291dCB0aGF0IGNhbiBzZWxmLXVw
>>"%PS1_B64%" echo ZGF0ZSBvbiBldmVyeSBwdXNoLgoKICBFeGFtcGxlOgogICAgLlxJbnN0YWxsLUdpdDEtS2lkLnBz
>>"%PS1_B64%" echo MSAtU2VydmVyIGh0dHBzOi8vZ2l0MS1zZXJ2ZXIub25yZW5kZXIuY29tIGAKICAgICAgICAtQ2hp
>>"%PS1_B64%" echo bGRVc2VyIEtpZGRvIC1CcmFuY2ggY2xhdWRlL3NldHVwLWdpdDEtZGV2LWVudmlyb25tZW50LVFl
>>"%PS1_B64%" echo TmRVCiM+CnBhcmFtKAogIFtzdHJpbmddJFNlcnZlciAgICAgID0gImh0dHBzOi8vZ2l0MS1zZXJ2
>>"%PS1_B64%" echo ZXIub25yZW5kZXIuY29tIiwKICBbc3RyaW5nXSRDaGlsZFVzZXIgICA9ICJLaWRkbyIsCiAgW3N0
>>"%PS1_B64%" echo cmluZ10kQ2hpbGRQYXNzd29yZCA9ICIiLCAgICAgICAgICAgICAgICAgIyBibGFuayA9IHBhc3N3
>>"%PS1_B64%" echo b3JkbGVzcyBraWQgbG9naW4KICBbc3RyaW5nXSRCcmFuY2ggICAgICA9ICJjbGF1ZGUvc2V0dXAt
>>"%PS1_B64%" echo Z2l0MS1kZXYtZW52aXJvbm1lbnQtUWVOZFUiLAogIFtzdHJpbmddJFJlcG9VcmwgICAgID0gImh0
>>"%PS1_B64%" echo dHBzOi8vZ2l0aHViLmNvbS9rdnItY29kZXIvZ2l0MS5naXQiLAogIFtzdHJpbmddJEluc3RhbGxE
>>"%PS1_B64%" echo aXIgID0gIkM6XFByb2dyYW1EYXRhXEdpdDEiICMgb3V0c2lkZSB0aGUga2lkJ3MgcHJvZmlsZQop
>>"%PS1_B64%" echo CgokRXJyb3JBY3Rpb25QcmVmZXJlbmNlID0gIlN0b3AiCmZ1bmN0aW9uIFN0ZXAoJG0pIHsgV3Jp
>>"%PS1_B64%" echo dGUtSG9zdCAiYG49PT0gJG0gPT09IiAtRm9yZWdyb3VuZENvbG9yIEN5YW4gfQoKIyAtLS0gMC4g
>>"%PS1_B64%" echo bXVzdCBiZSBhZG1pbiAodGhlIC5iYXQgZWxldmF0ZXM7IGRvdWJsZS1jaGVjayBoZXJlKSAtLS0K
>>"%PS1_B64%" echo aWYgKC1ub3QgKFtTZWN1cml0eS5QcmluY2lwYWwuV2luZG93c1ByaW5jaXBhbF1bU2VjdXJpdHku
>>"%PS1_B64%" echo UHJpbmNpcGFsLldpbmRvd3NJZGVudGl0eV06OkdldEN1cnJlbnQoKQogICAgICAgICkuSXNJblJv
>>"%PS1_B64%" echo bGUoW1NlY3VyaXR5LlByaW5jaXBhbC5XaW5kb3dzQnVpbHRpblJvbGVdOjpBZG1pbmlzdHJhdG9y
>>"%PS1_B64%" echo KSkgewogIHRocm93ICJSdW4gYXMgQWRtaW5pc3RyYXRvciAodXNlIEluc3RhbGwtR2l0MS1LaWQu
>>"%PS1_B64%" echo YmF0KS4iCn0KCiMgLS0tIDEuIHByZXJlcXVpc2l0ZXM6IFB5dGhvbiArIEdpdCAtLS0KU3RlcCAi
>>"%PS1_B64%" echo Q2hlY2tpbmcgcHJlcmVxdWlzaXRlcyAoUHl0aG9uLCBHaXQpIgpmdW5jdGlvbiBIYXZlKCRjbWQp
>>"%PS1_B64%" echo IHsgW2Jvb2xdKEdldC1Db21tYW5kICRjbWQgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUp
>>"%PS1_B64%" echo IH0KZnVuY3Rpb24gV2luZ2V0LUluc3RhbGwoJGlkKSB7CiAgaWYgKEhhdmUgd2luZ2V0KSB7CiAg
>>"%PS1_B64%" echo ICBXcml0ZS1Ib3N0ICIgIGluc3RhbGxpbmcgJGlkIHZpYSB3aW5nZXQuLi4iCiAgICB3aW5nZXQg
>>"%PS1_B64%" echo aW5zdGFsbCAtLWlkICRpZCAtZSAtLXNpbGVudCAtLWFjY2VwdC1zb3VyY2UtYWdyZWVtZW50cyAt
>>"%PS1_B64%" echo LWFjY2VwdC1wYWNrYWdlLWFncmVlbWVudHMKICB9IGVsc2UgewogICAgdGhyb3cgIndpbmdldCBu
>>"%PS1_B64%" echo b3QgYXZhaWxhYmxlIGFuZCAkaWQgaXMgbWlzc2luZy4gSW5zdGFsbCAkaWQgbWFudWFsbHksIHRo
>>"%PS1_B64%" echo ZW4gcmUtcnVuLiIKICB9Cn0KaWYgKC1ub3QgKEhhdmUgcHl0aG9uKSkgeyBXaW5nZXQtSW5zdGFs
>>"%PS1_B64%" echo bCAiUHl0aG9uLlB5dGhvbi4zLjEyIiB9CmlmICgtbm90IChIYXZlIGdpdCkpICAgIHsgV2luZ2V0
>>"%PS1_B64%" echo LUluc3RhbGwgIkdpdC5HaXQiIH0KIyByZWZyZXNoIFBBVEggZm9yIHRoaXMgc2Vzc2lvbiBzbyB0
>>"%PS1_B64%" echo aGUganVzdC1pbnN0YWxsZWQgdG9vbHMgYXJlIHZpc2libGUKJGVudjpQYXRoID0gW1N5c3RlbS5F
>>"%PS1_B64%" echo bnZpcm9ubWVudF06OkdldEVudmlyb25tZW50VmFyaWFibGUoIlBhdGgiLCJNYWNoaW5lIikgKyAi
>>"%PS1_B64%" echo OyIgKwogICAgICAgICAgICBbU3lzdGVtLkVudmlyb25tZW50XTo6R2V0RW52aXJvbm1lbnRWYXJp
>>"%PS1_B64%" echo YWJsZSgiUGF0aCIsIlVzZXIiKQppZiAoLW5vdCAoSGF2ZSBweXRob24pKSB7IHRocm93ICJQeXRo
>>"%PS1_B64%" echo b24gc3RpbGwgbm90IGZvdW5kIGFmdGVyIGluc3RhbGwg4oCUIG9wZW4gYSBuZXcgc2hlbGwgYW5k
>>"%PS1_B64%" echo IHJlLXJ1bi4iIH0KaWYgKC1ub3QgKEhhdmUgZ2l0KSkgICAgeyB0aHJvdyAiR2l0IHN0aWxsIG5v
>>"%PS1_B64%" echo dCBmb3VuZCBhZnRlciBpbnN0YWxsIOKAlCBvcGVuIGEgbmV3IHNoZWxsIGFuZCByZS1ydW4uIiB9
>>"%PS1_B64%" echo CgojIC0tLSAyLiBjbG9uZSAob3IgdXBkYXRlKSB0aGUgcmVwbyBpbnRvIGEgcHJvdGVjdGVkIGxv
>>"%PS1_B64%" echo Y2F0aW9uIC0tLQpTdGVwICJGZXRjaGluZyBhZ2VudCBjb2RlIC0+ICRJbnN0YWxsRGlyIgppZiAo
>>"%PS1_B64%" echo VGVzdC1QYXRoIChKb2luLVBhdGggJEluc3RhbGxEaXIgIi5naXQiKSkgewogIGdpdCAtQyAkSW5z
>>"%PS1_B64%" echo dGFsbERpciBmZXRjaCBvcmlnaW4gJEJyYW5jaAogIGdpdCAtQyAkSW5zdGFsbERpciBjaGVja291
>>"%PS1_B64%" echo dCAkQnJhbmNoCiAgZ2l0IC1DICRJbnN0YWxsRGlyIHB1bGwgLS1mZi1vbmx5IG9yaWdpbiAkQnJh
>>"%PS1_B64%" echo bmNoCn0gZWxzZSB7CiAgZ2l0IGNsb25lIC0tYnJhbmNoICRCcmFuY2ggJFJlcG9VcmwgJEluc3Rh
>>"%PS1_B64%" echo bGxEaXIKfQojIExvY2sgZG93bjogb25seSBBZG1pbmlzdHJhdG9ycy9TWVNURU0gY2FuIG1vZGlm
>>"%PS1_B64%" echo eSAoa2lkIGNhbid0IHRhbXBlciB3aXRoIGNvZGUpLgppY2FjbHMgJEluc3RhbGxEaXIgL2luaGVy
>>"%PS1_B64%" echo aXRhbmNlOnIgL2dyYW50OnIgIkFkbWluaXN0cmF0b3JzOihPSSkoQ0kpRiIgIlNZU1RFTTooT0kp
>>"%PS1_B64%" echo KENJKUYiICJVc2VyczooT0kpKENJKVJYIiB8IE91dC1OdWxsCgojIC0tLSAzLiBweXRob24gZGVw
>>"%PS1_B64%" echo cyAtLS0KU3RlcCAiSW5zdGFsbGluZyBQeXRob24gZGVwZW5kZW5jaWVzIgpweXRob24gLW0gcGlw
>>"%PS1_B64%" echo IGluc3RhbGwgLS11cGdyYWRlIHBpcCB8IE91dC1OdWxsCnB5dGhvbiAtbSBwaXAgaW5zdGFsbCAt
>>"%PS1_B64%" echo ciAoSm9pbi1QYXRoICRJbnN0YWxsRGlyICJhZ2VudFxyZXF1aXJlbWVudHMudHh0IikKCiMgLS0t
>>"%PS1_B64%" echo IDQuIGNyZWF0ZSB0aGUgZGVkaWNhdGVkIFNUQU5EQVJEIGNoaWxkIGFjY291bnQgLS0tClN0ZXAg
>>"%PS1_B64%" echo IkNyZWF0aW5nIHN0YW5kYXJkIGFjY291bnQgJyRDaGlsZFVzZXInIgokZXhpc3RpbmcgPSBHZXQt
>>"%PS1_B64%" echo TG9jYWxVc2VyIC1OYW1lICRDaGlsZFVzZXIgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUK
>>"%PS1_B64%" echo aWYgKCRleGlzdGluZykgewogIFdyaXRlLUhvc3QgIiAgYWNjb3VudCBhbHJlYWR5IGV4aXN0cyDi
>>"%PS1_B64%" echo gJQgbGVhdmluZyBpdCBhcy1pcy4iCn0gZWxzZSB7CiAgaWYgKCRDaGlsZFBhc3N3b3JkKSB7CiAg
>>"%PS1_B64%" echo ICAkc2VjID0gQ29udmVydFRvLVNlY3VyZVN0cmluZyAkQ2hpbGRQYXNzd29yZCAtQXNQbGFpblRl
>>"%PS1_B64%" echo eHQgLUZvcmNlCiAgICBOZXctTG9jYWxVc2VyIC1OYW1lICRDaGlsZFVzZXIgLVBhc3N3b3JkICRz
>>"%PS1_B64%" echo ZWMgLVBhc3N3b3JkTmV2ZXJFeHBpcmVzIC1GdWxsTmFtZSAiR2l0MSBLaWQiIHwgT3V0LU51bGwK
>>"%PS1_B64%" echo ICB9IGVsc2UgewogICAgTmV3LUxvY2FsVXNlciAtTmFtZSAkQ2hpbGRVc2VyIC1Ob1Bhc3N3b3Jk
>>"%PS1_B64%" echo IC1GdWxsTmFtZSAiR2l0MSBLaWQiIHwgT3V0LU51bGwKICB9CiAgQWRkLUxvY2FsR3JvdXBNZW1i
>>"%PS1_B64%" echo ZXIgLUdyb3VwICJVc2VycyIgLU1lbWJlciAkQ2hpbGRVc2VyIC1FcnJvckFjdGlvbiBTaWxlbnRs
>>"%PS1_B64%" echo eUNvbnRpbnVlCiAgV3JpdGUtSG9zdCAiICBjcmVhdGVkICckQ2hpbGRVc2VyJyBhcyBhIFN0YW5k
>>"%PS1_B64%" echo YXJkIHVzZXIuIgp9CiMgU2FmZXR5OiBtYWtlIHN1cmUgdGhlIGNoaWxkIGlzIE5PVCBhIGxvY2Fs
>>"%PS1_B64%" echo IEFkbWluaXN0cmF0b3IgKHdvdWxkIGJ5cGFzcyBldmVyeXRoaW5nKS4KdHJ5IHsKICBSZW1vdmUt
>>"%PS1_B64%" echo TG9jYWxHcm91cE1lbWJlciAtR3JvdXAgIkFkbWluaXN0cmF0b3JzIiAtTWVtYmVyICRDaGlsZFVz
>>"%PS1_B64%" echo ZXIgLUVycm9yQWN0aW9uIFN0b3AKICBXcml0ZS1XYXJuaW5nICIgICckQ2hpbGRVc2VyJyB3YXMg
>>"%PS1_B64%" echo YW4gQWRtaW5pc3RyYXRvciDigJQgZGVtb3RlZCB0byBTdGFuZGFyZC4iCn0gY2F0Y2ggeyB9ICMg
>>"%PS1_B64%" echo bm90IGFuIGFkbWluOiBleHBlY3RlZAoKIyAtLS0gNS4gaW5zdGFsbCB0aGUgaGFyZGVuZWQgc2Vy
>>"%PS1_B64%" echo dmljZSAocmV1c2VzIGluc3RhbGwtc2VydmljZS5wczEpIC0tLQpTdGVwICJJbnN0YWxsaW5nIGhh
>>"%PS1_B64%" echo cmRlbmVkIGFnZW50IHNlcnZpY2UiCiYgKEpvaW4tUGF0aCAkSW5zdGFsbERpciAic2NyaXB0c1xp
>>"%PS1_B64%" echo bnN0YWxsLXNlcnZpY2UucHMxIikgYAogICAgLVNlcnZlciAkU2VydmVyIC1DaGlsZFVzZXIgJENo
>>"%PS1_B64%" echo aWxkVXNlciAtVXBkYXRlQnJhbmNoICRCcmFuY2gKCiMgLS0tIDViLiBraWQtZmFjaW5nIGFwcDog
>>"%PS1_B64%" echo dHJheSBpY29uICsgc2hvcnRjdXRzICsgYXV0b3J1biBhdCBraWQgbG9naW4gLS0tClN0ZXAgIlNl
>>"%PS1_B64%" echo dHRpbmcgdXAgdGhlIGtpZCdzICdHaXQxIOKAlCBNeSB0aW1lJyBhcHAiCiRweXRob24gICAgPSAo
>>"%PS1_B64%" echo R2V0LUNvbW1hbmQgcHl0aG9uIC1FcnJvckFjdGlvbiBTaWxlbnRseUNvbnRpbnVlKS5Tb3VyY2UK
>>"%PS1_B64%" echo JHB5dGhvbncgICA9IGlmICgkcHl0aG9uKSB7IEpvaW4tUGF0aCAoU3BsaXQtUGF0aCAkcHl0aG9u
>>"%PS1_B64%" echo KSAicHl0aG9udy5leGUiIH0gZWxzZSB7ICIiIH0KaWYgKC1ub3QgKFRlc3QtUGF0aCAkcHl0aG9u
>>"%PS1_B64%" echo dykpIHsgJHB5dGhvbncgPSAkcHl0aG9uIH0gICAjIGZhbGxiYWNrCiR0cmF5UHkgICAgPSBKb2lu
>>"%PS1_B64%" echo LVBhdGggJEluc3RhbGxEaXIgImFnZW50XHRyYXkucHkiCiR3c2ggICAgICAgPSBOZXctT2JqZWN0
>>"%PS1_B64%" echo IC1Db21PYmplY3QgV1NjcmlwdC5TaGVsbAoKIyBSZXNvbHZlIHRoZSBjaGlsZCdzIHByb2ZpbGUg
>>"%PS1_B64%" echo cGF0aCAoaGFuZGxlcyBub24tZGVmYXVsdCBVc2VycyBsb2NhdGlvbnMpLgokY2hpbGRQcm9maWxl
>>"%PS1_B64%" echo ID0gJG51bGwKdHJ5IHsKICAkY2hpbGRTaWRPYmogPSAoTmV3LU9iamVjdCBTeXN0ZW0uU2VjdXJp
>>"%PS1_B64%" echo dHkuUHJpbmNpcGFsLk5UQWNjb3VudCgkQ2hpbGRVc2VyKQogICAgICAgICAgICAgICAgKS5UcmFu
>>"%PS1_B64%" echo c2xhdGUoW1N5c3RlbS5TZWN1cml0eS5QcmluY2lwYWwuU2VjdXJpdHlJZGVudGlmaWVyXSkuVmFs
>>"%PS1_B64%" echo dWUKICAkcHJvZktleSA9ICJIS0xNOlxTT0ZUV0FSRVxNaWNyb3NvZnRcV2luZG93cyBOVFxDdXJy
>>"%PS1_B64%" echo ZW50VmVyc2lvblxQcm9maWxlTGlzdFwkY2hpbGRTaWRPYmoiCiAgaWYgKFRlc3QtUGF0aCAkcHJv
>>"%PS1_B64%" echo ZktleSkgeyAkY2hpbGRQcm9maWxlID0gKEdldC1JdGVtUHJvcGVydHkgJHByb2ZLZXkpLlByb2Zp
>>"%PS1_B64%" echo bGVJbWFnZVBhdGggfQp9IGNhdGNoIHt9CmlmICgtbm90ICRjaGlsZFByb2ZpbGUpIHsgJGNoaWxk
>>"%PS1_B64%" echo UHJvZmlsZSA9ICJDOlxVc2Vyc1wkQ2hpbGRVc2VyIiB9CgojIE1ha2UgdGhlIHByb2ZpbGUgc2hl
>>"%PS1_B64%" echo bGwgZm9sZGVycyBpZiBXaW5kb3dzIGhhc24ndCBpbml0aWFsaXNlZCB0aGVtIHlldC4KJGNoaWxk
>>"%PS1_B64%" echo RGVza3RvcCA9IEpvaW4tUGF0aCAkY2hpbGRQcm9maWxlICJEZXNrdG9wIgokY2hpbGRTdGFydHVw
>>"%PS1_B64%" echo ID0gSm9pbi1QYXRoICRjaGlsZFByb2ZpbGUgIkFwcERhdGFcUm9hbWluZ1xNaWNyb3NvZnRcV2lu
>>"%PS1_B64%" echo ZG93c1xTdGFydCBNZW51XFByb2dyYW1zXFN0YXJ0dXAiCiRjaGlsZFN0YXJ0ICAgPSBKb2luLVBh
>>"%PS1_B64%" echo dGggJGNoaWxkUHJvZmlsZSAiQXBwRGF0YVxSb2FtaW5nXE1pY3Jvc29mdFxXaW5kb3dzXFN0YXJ0
>>"%PS1_B64%" echo IE1lbnVcUHJvZ3JhbXMiCmZvcmVhY2ggKCRkIGluIEAoJGNoaWxkRGVza3RvcCwgJGNoaWxkU3Rh
>>"%PS1_B64%" echo cnR1cCwgJGNoaWxkU3RhcnQpKSB7CiAgTmV3LUl0ZW0gLUl0ZW1UeXBlIERpcmVjdG9yeSAtRm9y
>>"%PS1_B64%" echo Y2UgLVBhdGggJGQgfCBPdXQtTnVsbAp9CgpmdW5jdGlvbiBOZXctU2hvcnRjdXQoJHBhdGgsICR0
>>"%PS1_B64%" echo YXJnZXQsICRhcmdzLCAkZGVzY3JpcHRpb24pIHsKICAkc2MgPSAkd3NoLkNyZWF0ZVNob3J0Y3V0
>>"%PS1_B64%" echo KCRwYXRoKQogICRzYy5UYXJnZXRQYXRoID0gJHRhcmdldAogICRzYy5Bcmd1bWVudHMgID0gJGFy
>>"%PS1_B64%" echo Z3MKICAkc2MuRGVzY3JpcHRpb24gPSAkZGVzY3JpcHRpb24KICAkc2MuV29ya2luZ0RpcmVjdG9y
>>"%PS1_B64%" echo eSA9IChTcGxpdC1QYXRoICR0YXJnZXQgLVBhcmVudCkKICAkc2MuSWNvbkxvY2F0aW9uID0gIiR0
>>"%PS1_B64%" echo YXJnZXQsMCIKICAkc2MuU2F2ZSgpCn0KCiMgRGVza3RvcCArIFN0YXJ0IE1lbnUgc2hvcnRjdXQ6
>>"%PS1_B64%" echo IG9wZW5zIGRhc2hib2FyZCBpbiBkZWZhdWx0IGJyb3dzZXIuCiRkYXNoVXJsID0gImh0dHA6Ly8x
>>"%PS1_B64%" echo MjcuMC4wLjE6MTc2NTQiCiRpZUV4cGxvcmUgPSAiJGVudjpTeXN0ZW1Sb290XGV4cGxvcmVyLmV4
>>"%PS1_B64%" echo ZSIKTmV3LVNob3J0Y3V0IChKb2luLVBhdGggJGNoaWxkRGVza3RvcCAiR2l0MSAtIE15IHRpbWUu
>>"%PS1_B64%" echo bG5rIikgJGllRXhwbG9yZSAkZGFzaFVybCAiWW91ciBHaXQxIHRpbWUgZGFzaGJvYXJkIgpOZXct
>>"%PS1_B64%" echo U2hvcnRjdXQgKEpvaW4tUGF0aCAkY2hpbGRTdGFydCAgICJHaXQxIC0gTXkgdGltZS5sbmsiKSAk
>>"%PS1_B64%" echo aWVFeHBsb3JlICRkYXNoVXJsICJZb3VyIEdpdDEgdGltZSBkYXNoYm9hcmQiCgojIFN0YXJ0dXAg
>>"%PS1_B64%" echo aXRlbXM6IHRyYXkgaWNvbiArIHN1YnRsZSBkZXNrdG9wIG92ZXJsYXksIGJvdGggYXQgdGhlIGtp
>>"%PS1_B64%" echo ZCdzIGxvZ29uLgokb3ZlcmxheVB5ID0gSm9pbi1QYXRoICRJbnN0YWxsRGlyICJhZ2VudFxvdmVy
>>"%PS1_B64%" echo bGF5LnB5IgpOZXctU2hvcnRjdXQgKEpvaW4tUGF0aCAkY2hpbGRTdGFydHVwICJHaXQxIFRyYXku
>>"%PS1_B64%" echo bG5rIikgICAgJHB5dGhvbncgImAiJHRyYXlQeWAiIiAgICAiR2l0MSB0cmF5IGljb24iCk5ldy1T
>>"%PS1_B64%" echo aG9ydGN1dCAoSm9pbi1QYXRoICRjaGlsZFN0YXJ0dXAgIkdpdDEgT3ZlcmxheS5sbmsiKSAkcHl0
>>"%PS1_B64%" echo aG9udyAiYCIkb3ZlcmxheVB5YCIiICJHaXQxIHRpbWUtbGVmdCBvdmVybGF5IgoKV3JpdGUtSG9z
>>"%PS1_B64%" echo dCAiICBEZXNrdG9wICsgU3RhcnQgTWVudSBzaG9ydGN1dDogJ0dpdDEgLSBNeSB0aW1lJyAob3Bl
>>"%PS1_B64%" echo bnMgZGFzaGJvYXJkKS4iCldyaXRlLUhvc3QgIiAgVHJheSBpY29uICsgY29ybmVyIG92ZXJsYXkg
>>"%PS1_B64%" echo c3RhcnQgYXV0b21hdGljYWxseSB3aGVuICckQ2hpbGRVc2VyJyBsb2dzIGluLiIKCiMgLS0tIDYu
>>"%PS1_B64%" echo IHNob3cgdGhlIHBhaXJpbmcgY29kZSAtLS0KU3RlcCAiUGFpcmluZyIKJGxvZyA9IEpvaW4tUGF0
>>"%PS1_B64%" echo aCAkSW5zdGFsbERpciAiYWdlbnRcYWdlbnQubG9nIgpXcml0ZS1Ib3N0ICJXYWl0aW5nIGZvciB0
>>"%PS1_B64%" echo aGUgYWdlbnQgdG8gcHJpbnQgYSBwYWlyaW5nIGNvZGUuLi4iCiRjb2RlID0gJG51bGwKZm9yICgk
>>"%PS1_B64%" echo aSA9IDA7ICRpIC1sdCAzMCAtYW5kIC1ub3QgJGNvZGU7ICRpKyspIHsKICBTdGFydC1TbGVlcCAt
>>"%PS1_B64%" echo U2Vjb25kcyAyCiAgaWYgKFRlc3QtUGF0aCAkbG9nKSB7CiAgICAkbSA9IFNlbGVjdC1TdHJpbmcg
>>"%PS1_B64%" echo LVBhdGggJGxvZyAtUGF0dGVybiAicGFpci4qPyhcZHs2fSkiIC1FcnJvckFjdGlvbiBTaWxlbnRs
>>"%PS1_B64%" echo eUNvbnRpbnVlIHwKICAgICAgICAgU2VsZWN0LU9iamVjdCAtTGFzdCAxCiAgICBpZiAoJG0pIHsg
>>"%PS1_B64%" echo JGNvZGUgPSAkbS5NYXRjaGVzWzBdLkdyb3Vwc1sxXS5WYWx1ZSB9CiAgfQp9CldyaXRlLUhvc3Qg
>>"%PS1_B64%" echo IiIKaWYgKCRjb2RlKSB7CiAgV3JpdGUtSG9zdCAiICBQQUlSSU5HIENPREU6ICRjb2RlIiAtRm9y
>>"%PS1_B64%" echo ZWdyb3VuZENvbG9yIEdyZWVuCiAgV3JpdGUtSG9zdCAiICBFbnRlciBpdCBpbiB0aGUgR2l0MSBh
>>"%PS1_B64%" echo cHAgKFBhaXIgbmV3IGRldmljZSkuIgp9IGVsc2UgewogIFdyaXRlLUhvc3QgIiAgTm8gY29kZSB5
>>"%PS1_B64%" echo ZXQuIFRhaWwgdGhlIGxvZyB0byBmaW5kIGl0OiIgLUZvcmVncm91bmRDb2xvciBZZWxsb3cKICBX
>>"%PS1_B64%" echo cml0ZS1Ib3N0ICIgICAgR2V0LUNvbnRlbnQgYCIkbG9nYCIgLVdhaXQiCn0KCldyaXRlLUhvc3Qg
>>"%PS1_B64%" echo ImBuQWxsIHNldC4gVGhlIGFnZW50IHdpbGwgYXV0by1zdGFydCBhdCBib290IGFuZCBzZWxmLXVw
>>"%PS1_B64%" echo ZGF0ZSBvbiBlYWNoIHB1c2guIiAtRm9yZWdyb3VuZENvbG9yIEdyZWVuCldyaXRlLUhvc3QgIkhh
>>"%PS1_B64%" echo dmUgdGhlIGNoaWxkIGxvZyBpbiB0byB0aGUgJyRDaGlsZFVzZXInIGFjY291bnQgdG8gdXNlIHRo
>>"%PS1_B64%" echo ZSBQQy4iCgojIC0tLSBzYWZldHkgbmV0OiBwdXQgdGhlIGVtZXJnZW5jeSBvZmYtc3dpdGNoICsg
>>"%PS1_B64%" echo cmUtcGFpciB0b29sIG9uIHRoZSBkZXNrdG9wIC0tLQpTdGVwICJMb2Nrb3V0IHNhZmV0eSIKJHJl
>>"%PS1_B64%" echo Y292ZXJTcmMgPSBKb2luLVBhdGggJEluc3RhbGxEaXIgInNjcmlwdHNcUmVjb3Zlci1HaXQxLmJh
>>"%PS1_B64%" echo dCIKJHJlcGFpclNyYyAgPSBKb2luLVBhdGggJEluc3RhbGxEaXIgInNjcmlwdHNcUmVwYWlyLVBh
>>"%PS1_B64%" echo aXItR2l0MS5iYXQiCnRyeSB7CiAgQ29weS1JdGVtICRyZWNvdmVyU3JjICJDOlxVc2Vyc1xQdWJs
>>"%PS1_B64%" echo aWNcRGVza3RvcFxSZWNvdmVyLUdpdDEuYmF0IiAtRm9yY2UKICBXcml0ZS1Ib3N0ICIgIFBsYWNl
>>"%PS1_B64%" echo ZCAnUmVjb3Zlci1HaXQxLmJhdCcgb24gdGhlIGRlc2t0b3AgKGVtZXJnZW5jeSBvZmYgc3dpdGNo
>>"%PS1_B64%" echo KS4iCn0gY2F0Y2ggeyBXcml0ZS1Ib3N0ICIgIFJlY292ZXJ5IHNjcmlwdCBsaXZlcyBhdDogJHJl
>>"%PS1_B64%" echo Y292ZXJTcmMiIH0KdHJ5IHsKICBDb3B5LUl0ZW0gJHJlcGFpclNyYyAiQzpcVXNlcnNcUHVibGlj
>>"%PS1_B64%" echo XERlc2t0b3BcUmVwYWlyLVBhaXItR2l0MS5iYXQiIC1Gb3JjZQogIFdyaXRlLUhvc3QgIiAgUGxh
>>"%PS1_B64%" echo Y2VkICdSZXBhaXItUGFpci1HaXQxLmJhdCcgb24gdGhlIGRlc2t0b3AgKHBhcmVudCByZWNvdmVy
>>"%PS1_B64%" echo eSBjb2RlIC0+IHJlLXBhaXIpLiIKfSBjYXRjaCB7IFdyaXRlLUhvc3QgIiAgUmUtcGFpciBzY3Jp
>>"%PS1_B64%" echo cHQgbGl2ZXMgYXQ6ICRyZXBhaXJTcmMiIH0KCldyaXRlLUhvc3QgIiIKV3JpdGUtSG9zdCAiSU1Q
>>"%PS1_B64%" echo T1JUQU5UIOKAlCB5b3UgY2FuIEFMV0FZUyB1bmRvIHRoaXM6IiAtRm9yZWdyb3VuZENvbG9yIFll
>>"%PS1_B64%" echo bGxvdwpXcml0ZS1Ib3N0ICIgICogRW5mb3JjZW1lbnQgb25seSBhZmZlY3RzIHRoZSAnJENoaWxk
>>"%PS1_B64%" echo VXNlcicgYWNjb3VudC4gWW91ciBPV04gYWRtaW4iCldyaXRlLUhvc3QgIiAgICBhY2NvdW50IGlz
>>"%PS1_B64%" echo IG5ldmVyIGxvY2tlZCBhbmQga2VlcHMgaW50ZXJuZXQg4oCUIGxvZyBpbnRvIGl0IHRvIGZpeCB0
>>"%PS1_B64%" echo aGluZ3MuIgpXcml0ZS1Ib3N0ICIgICogUnVuICdSZWNvdmVyLUdpdDEuYmF0JyAoZGVza3RvcCkg
>>"%PS1_B64%" echo dG8gZnVsbHkgZGlzYXJtLCBldmVuIHdpdGggbm8gc2VydmVyLiIKV3JpdGUtSG9zdCAiICAqIFdv
>>"%PS1_B64%" echo cnN0IGNhc2UsIGJvb3QgaW50byBTQUZFIE1PREUgdGhlbiBydW4gUmVjb3Zlci1HaXQxLmJhdC4i
>>"%PS1_B64%" echo CldyaXRlLUhvc3QgIiAgPj4gTWFrZSBzdXJlIHlvdXIgYWRtaW4gYWNjb3VudCBoYXMgYSBQQVNT
>>"%PS1_B64%" echo V09SRCBZT1UgUkVNRU1CRVIgYmVmb3JlIHlvdSIKV3JpdGUtSG9zdCAiICAgICBsZWF2ZSB0aGlz
>>"%PS1_B64%" echo IFBDIHdpdGggdGhlIGNoaWxkLiBUaGF0J3MgeW91ciBndWFyYW50ZWVkIHdheSBiYWNrIGluLiIK
>>"%PS1_B64%" echo V3JpdGUtSG9zdCAiIgpXcml0ZS1Ib3N0ICJSRUNPTU1FTkRFRCBGSVJTVDogcnVuIGEgc2FmZSB0
>>"%PS1_B64%" echo cmlhbCBiZWZvcmUgdHJ1c3RpbmcgaXQgLSIgLUZvcmVncm91bmRDb2xvciBDeWFuCldyaXRlLUhv
>>"%PS1_B64%" echo c3QgIiAgVGVzdC1HaXQxLmJhdCAgICAoYXJtcyBhIGd1YXJhbnRlZWQgYXV0by1kaXNhcm0gYWZ0
>>"%PS1_B64%" echo ZXIgMTAgbWluLCBzbyB5b3UiCldyaXRlLUhvc3QgIiAgICAgICAgICAgICAgICAgICAgY2FuIHRl
>>"%PS1_B64%" echo c3QgbG9jay9pbnRlcm5ldC9yZWNvdmVyIHdpdGggemVybyByaXNrKS4iCg==

powershell -NoProfile -Command "[IO.File]::WriteAllBytes('%PS1%',[Convert]::FromBase64String((Get-Content -Raw '%PS1_B64%')))"
if not exist "%PS1%" (
  echo Failed to extract the PowerShell installer.
  pause
  exit /b 1
)
del "%PS1_B64%" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" ^
  -Server "%GIT1_SERVER%" -ChildUser "%CHILD_USER%" -Branch "%BRANCH%"

del "%PS1%" >nul 2>&1
echo.
pause
