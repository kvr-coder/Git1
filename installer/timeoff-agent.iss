; timeoff-agent.iss — Inno Setup script that produces timeoff-agent-setup.exe.
;
; Strategy: keep the heavy lifting (Python + Git + service install + standard
; user creation + pairing) in PowerShell. The .exe is just an Inno Setup
; wrapper that:
;   * elevates to admin (Inno does this automatically with PrivilegesRequired=admin),
;   * unpacks an embedded copy of Install-Git1-Kid.ps1 and Install-Git1-Kid.bat,
;   * runs Install-Git1-Kid.bat -Server <PARAM> -Code <PARAM>,
;   * shows progress and surfaces the pairing code on success.
;
; Why .exe and not .bat: SmartScreen + Defender treat unsigned .bat as
; high-risk (cmd downloading + executing scripts is textbook malware).
; Inno Setup .exe is the format Microsoft has the most reputation data on,
; and it earns SmartScreen rep over weeks even unsigned.
;
; Code-signing: leave unsigned for the first 5,000 installs; submit each
; release to https://www.microsoft.com/wdsi/filesubmission so Defender
; whitelists. Upgrade to an EV cert (~$300/yr) once paying users exist.

#define MyAppName "timeoff agent"
#define MyAppVersion GetEnv("TIMEOFF_VERSION")
#if "{#MyAppVersion}" == ""
  #define MyAppVersion "0.0.0-dev"
#endif
#define MyAppPublisher "timeoff"
#define MyAppURL "https://timeoff.app"

[Setup]
AppId={{8F2C8F71-9F1B-4F1F-9C2A-7E72A2A1B6E0}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={commonpf}\timeoff
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputBaseFilename=timeoff-agent-setup
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
; Single architecture target keeps the file small.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; A real icon ships in /installer/icon.ico in a follow-up; placeholder fine.
; SetupIconFile=icon.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Embed the existing PowerShell + batch installer.
Source: "..\scripts\Install-Git1-Kid.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\scripts\Install-Git1-Kid.bat"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Run]
; Hand-off to the existing installer. Inno Setup is already elevated, so the
; .bat's self-elevation is a no-op. The /Code parameter pre-fills the pairing
; code (received from the email link / QR query string).
Filename: "{app}\scripts\Install-Git1-Kid.bat"; \
  Parameters: "/Server ""{code:GetParam|server}"" /Code ""{code:GetParam|code}"""; \
  Flags: runhidden waituntilterminated; \
  StatusMsg: "Installing the timeoff agent (Python + service + standard kid account)..."

[Code]
function GetParam(Default: string): string;
var
  i: Integer;
  Prefix: string;
begin
  Result := '';
  Prefix := '/' + Default + '=';
  for i := 1 to ParamCount do
    if Pos(LowerCase(Prefix), LowerCase(ParamStr(i))) = 1 then begin
      Result := Copy(ParamStr(i), Length(Prefix) + 1, MaxInt);
      Exit;
    end;
end;
