#Requires -Version 5.1
<#
.SYNOPSIS
  Keeps the system mouse cursor on the primary (host) monitor during dual-display play.

.DESCRIPTION
  Uses Win32 ClipCursor to confine the pointer to the primary screen bounds.
  Toggle hotkey Ctrl+Alt+Shift+M releases or re-applies the clip so the host can
  briefly use the external monitor (F11, reload, tab bar, etc.).
  Ctrl+Alt+Shift+C centers the cursor on the monitor it is currently on.

  Started hidden by RISQUE.ps1 dual launch. Disable with env RISQUE_NO_CURSOR_CLIP=1.
#>
param(
    [Parameter(Mandatory)]
    [string]$ClipRect,

    [Parameter(Mandatory)]
    [string]$StatePath,

    [int]$HotkeyToggleVk = 0x4D,
    [int]$HotkeyCenterVk = 0x43
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct RisqueWinRect {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

[StructLayout(LayoutKind.Sequential)]
public struct RisqueWinPoint {
    public int X;
    public int Y;
}

public static class RisqueCursorClip {
    public const int WM_HOTKEY = 0x0312;
    public const int HOTKEY_ID_TOGGLE = 0x524953; /* RIS — M toggle clip */
    public const int HOTKEY_ID_CENTER = 0x524954; /* RIS+1 — C center */
    public const uint MOD_CONTROL = 0x0002;
    public const uint MOD_ALT = 0x0001;
    public const uint MOD_SHIFT = 0x0004;
    public const uint MOD_NOREPEAT = 0x4000;

    [DllImport("user32.dll")]
    public static extern bool ClipCursor(ref RisqueWinRect lpRect);

    [DllImport("user32.dll")]
    public static extern bool ClipCursor(IntPtr lpRect);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out RisqueWinPoint lpPoint);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    public const uint PM_REMOVE = 0x0001;

    [DllImport("user32.dll")]
    public static extern bool PeekMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax, uint wRemoveMsg);

    [DllImport("user32.dll")]
    public static extern bool TranslateMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    public static extern IntPtr DispatchMessage(ref MSG lpMsg);

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public RisqueWinPoint pt;
    }

    public static bool PointInRect(RisqueWinPoint pt, RisqueWinRect r) {
        return pt.X >= r.Left && pt.X < r.Right && pt.Y >= r.Top && pt.Y < r.Bottom;
    }

    public static void Release() {
        ClipCursor(IntPtr.Zero);
    }

    public static void Apply(RisqueWinRect r) {
        RisqueWinPoint pt;
        if (GetCursorPos(out pt) && !PointInRect(pt, r)) {
            int cx = r.Left + (r.Right - r.Left) / 2;
            int cy = r.Top + (r.Bottom - r.Top) / 2;
            SetCursorPos(cx, cy);
        }
        ClipCursor(ref r);
    }
}
'@

function Parse-ClipRect {
    param([string]$Text)
    $parts = $Text -split ','
    if ($parts.Count -ne 4) {
        throw "ClipRect must be left,top,right,bottom (got: $Text)"
    }
    $nums = @()
    foreach ($p in $parts) {
        $n = 0
        if (-not [int]::TryParse($p.Trim(), [ref]$n)) {
            throw "Invalid ClipRect number: $p"
        }
        $nums += $n
    }
    if ($nums[2] -le $nums[0] -or $nums[3] -le $nums[1]) {
        throw "ClipRect must have right>left and bottom>top"
    }
    $r = New-Object RisqueWinRect
    $r.Left = $nums[0]
    $r.Top = $nums[1]
    $r.Right = $nums[2]
    $r.Bottom = $nums[3]
    return $r
}

function Write-GuardPidFile {
    param([int]$GuardProcessId)
    $path = Join-Path $env:TEMP "risque-cursor-guard.pid"
    try {
        [System.IO.File]::WriteAllText($path, [string]$GuardProcessId)
    }
    catch { }
}

function Remove-GuardPidFile {
    $path = Join-Path $env:TEMP "risque-cursor-guard.pid"
    try {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
    }
    catch { }
}

$clip = Parse-ClipRect -Text $ClipRect
$clipped = $true

function Write-CursorGuardStateFile {
    param([bool]$Clipped)
    if ([string]::IsNullOrWhiteSpace($StatePath)) { return }
    try {
        $dir = Split-Path -Parent $StatePath
        if ($dir -and -not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        $payload = @{
            clipped = [bool]$Clipped
            updated = (Get-Date).ToString("o")
        } | ConvertTo-Json -Compress
        $utf8 = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($StatePath, $payload, $utf8)
    }
    catch { }
}

function Set-ClipState {
    param([bool]$On)
    if ($On) {
        [RisqueCursorClip]::Apply($clip)
        $script:clipped = $true
    }
    else {
        [RisqueCursorClip]::Release()
        $script:clipped = $false
    }
    Write-CursorGuardStateFile -Clipped $script:clipped
}

function Sync-ClipStateFromFile {
    if ([string]::IsNullOrWhiteSpace($StatePath) -or -not (Test-Path -LiteralPath $StatePath)) {
        return
    }
    try {
        $raw = [System.IO.File]::ReadAllText($StatePath)
        if ([string]::IsNullOrWhiteSpace($raw)) { return }
        $j = $raw | ConvertFrom-Json
        if ($null -eq $j) { return }
        $wantClipped = $true
        if ($j.clipped -eq $false) { $wantClipped = $false }
        if ($wantClipped -ne $script:clipped) {
            Set-ClipState -On $wantClipped
        }
    }
    catch { }
}

function Move-RisqueCursorToMonitorCenter {
    $pt = New-Object RisqueWinPoint
    if (-not [RisqueCursorClip]::GetCursorPos([ref]$pt)) {
        return
    }
    if ($script:clipped) {
        $cx = $clip.Left + [int](($clip.Right - $clip.Left) / 2)
        $cy = $clip.Top + [int](($clip.Bottom - $clip.Top) / 2)
        [void][RisqueCursorClip]::SetCursorPos($cx, $cy)
        return
    }
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
    $drawingPoint = New-Object System.Drawing.Point($pt.X, $pt.Y)
    $screen = [System.Windows.Forms.Screen]::FromPoint($drawingPoint)
    $b = $screen.Bounds
    $cx = $b.Left + [int]($b.Width / 2)
    $cy = $b.Top + [int]($b.Height / 2)
    [void][RisqueCursorClip]::SetCursorPos($cx, $cy)
}

function Stop-Guard {
    foreach ($hid in @(
            [RisqueCursorClip]::HOTKEY_ID_TOGGLE,
            [RisqueCursorClip]::HOTKEY_ID_CENTER
        )) {
        try {
            [void][RisqueCursorClip]::UnregisterHotKey([IntPtr]::Zero, $hid)
        }
        catch { }
    }
    [RisqueCursorClip]::Release()
    Write-CursorGuardStateFile -Clipped $true
    Remove-GuardPidFile
}

trap {
    Stop-Guard
    break
}

Write-GuardPidFile -GuardProcessId $PID
Set-ClipState -On $true

$mods = [RisqueCursorClip]::MOD_CONTROL -bor [RisqueCursorClip]::MOD_ALT -bor [RisqueCursorClip]::MOD_SHIFT -bor [RisqueCursorClip]::MOD_NOREPEAT
$toggleOk = [RisqueCursorClip]::RegisterHotKey([IntPtr]::Zero, [RisqueCursorClip]::HOTKEY_ID_TOGGLE, $mods, [uint32]$HotkeyToggleVk)
$centerOk = [RisqueCursorClip]::RegisterHotKey([IntPtr]::Zero, [RisqueCursorClip]::HOTKEY_ID_CENTER, $mods, [uint32]$HotkeyCenterVk)
if (-not $toggleOk -or -not $centerOk) {
    Stop-Guard
    exit 2
}

try {
    $msgType = [RisqueCursorClip+MSG]
    $msg = [Activator]::CreateInstance($msgType)
    while ($true) {
        Sync-ClipStateFromFile
        while ([RisqueCursorClip]::PeekMessage([ref]$msg, [IntPtr]::Zero, 0, 0, [RisqueCursorClip]::PM_REMOVE)) {
            if ($msg.message -eq [RisqueCursorClip]::WM_HOTKEY) {
                $hk = $msg.wParam.ToInt32()
                if ($hk -eq [RisqueCursorClip]::HOTKEY_ID_TOGGLE) {
                    Set-ClipState -On (-not $script:clipped)
                    continue
                }
                if ($hk -eq [RisqueCursorClip]::HOTKEY_ID_CENTER) {
                    Move-RisqueCursorToMonitorCenter
                    continue
                }
            }
            [void][RisqueCursorClip]::TranslateMessage([ref]$msg)
            [void][RisqueCursorClip]::DispatchMessage([ref]$msg)
        }
        Start-Sleep -Milliseconds 120
    }
}
finally {
    Stop-Guard
}
