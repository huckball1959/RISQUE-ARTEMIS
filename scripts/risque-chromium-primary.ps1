# Win32 helpers for RISQUE.ps1 dual-display launch: Chromium/Edge top-level windows, TV move, F11.
# Edge and Chrome use Chromium; top-level browser windows are class "Chrome_WidgetWin_1".

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class ChromiumWindowHelper {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern IntPtr GetParent(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    public static readonly IntPtr HWND_TOP = IntPtr.Zero;

    public static List<IntPtr> ListRootChromium() {
        var list = new List<IntPtr>();
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            if (GetParent(hWnd) != IntPtr.Zero) return true;
            var sb = new StringBuilder(256);
            if (GetClassName(hWnd, sb, sb.Capacity) == 0) return true;
            if (sb.ToString() == "Chrome_WidgetWin_1") {
                list.Add(hWnd);
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static bool MoveTo(IntPtr hWnd, int left, int top, int width, int height) {
        if (hWnd == IntPtr.Zero) return false;
        /* uFlags 0: apply X,Y,cx,cy (not SWP_NOMOVE | SWP_NOSIZE) */
        return SetWindowPos(hWnd, HWND_TOP, left, top, width, height, 0);
    }
}
'@

function Wait-RisqueNewChromiumWindow {
    param(
        [IntPtr[]]$BeforeHandles,
        [int]$TimeoutMs = 20000
    )
    $before = New-Object 'System.Collections.Generic.HashSet[System.IntPtr]'
    if ($BeforeHandles) {
        foreach ($h in $BeforeHandles) {
            if ($h -ne [IntPtr]::Zero) { [void]$before.Add($h) }
        }
    }
    $deadline = [Environment]::TickCount + $TimeoutMs
    while ([Environment]::TickCount -lt $deadline) {
        $now = [ChromiumWindowHelper]::ListRootChromium()
        foreach ($h in $now) {
            if (-not $before.Contains($h)) {
                return $h
            }
        }
        Start-Sleep -Milliseconds 200
    }
    return [IntPtr]::Zero
}

function Move-RisqueChromiumToRect {
    param(
        [IntPtr]$Handle,
        [int]$Left,
        [int]$Top,
        [int]$Width,
        [int]$Height
    )
    if ($Handle -eq [IntPtr]::Zero) { return }
    [void][ChromiumWindowHelper]::MoveTo($Handle, $Left, $Top, $Width, $Height)
}

try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RisqueFgWin {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
}
catch {
    /* type already loaded in this PowerShell session */
}

function Enter-RisqueChromiumF11Fullscreen {
    param([IntPtr]$Handle)
    if ($Handle -eq [IntPtr]::Zero) { return }
    [void][RisqueFgWin]::SetForegroundWindow($Handle)
    Start-Sleep -Milliseconds 450
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait("{F11}")
}

function Stop-RisqueCursorGuard {
    $pidPath = Join-Path $env:TEMP "risque-cursor-guard.pid"
    if (Test-Path -LiteralPath $pidPath) {
        try {
            $guardPid = [int](Get-Content -LiteralPath $pidPath -Raw).Trim()
            if ($guardPid -gt 0) {
                Stop-Process -Id $guardPid -Force -ErrorAction SilentlyContinue
            }
        }
        catch { }
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
    }
    try {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RisqueCursorClipRelease {
    [DllImport("user32.dll")] public static extern bool ClipCursor(IntPtr lpRect);
    public static void Release() { ClipCursor(IntPtr.Zero); }
}
'@ -ErrorAction SilentlyContinue
        [RisqueCursorClipRelease]::Release()
    }
    catch { }
}

function Start-RisqueCursorGuard {
    param(
        [Parameter(Mandatory)][System.Drawing.Rectangle]$PrimaryBounds,
        [Parameter(Mandatory)][string]$ScriptsDirectory,
        [Parameter(Mandatory)][string]$SaveRootPath
    )
    if ($env:RISQUE_NO_CURSOR_CLIP -eq '1') { return }
    $guardScript = Join-Path $ScriptsDirectory "risque-cursor-guard.ps1"
    if (-not (Test-Path -LiteralPath $guardScript)) {
        Write-Warning "Cursor guard script missing: $guardScript"
        return
    }
    Stop-RisqueCursorGuard
    $b = $PrimaryBounds
    $clipArg = "{0},{1},{2},{3}" -f $b.Left, $b.Top, ($b.Left + $b.Width), ($b.Top + $b.Height)
    $statePath = Join-Path $SaveRootPath ".risque-cursor-guard-state.json"
    $psArgs = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-WindowStyle", "Hidden",
        "-File", $guardScript,
        "-ClipRect", $clipArg,
        "-StatePath", $statePath
    )
    Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -WindowStyle Hidden | Out-Null
    Write-Host ""
    Write-Host "Cursor guard: mouse stays on the host (primary) display." -ForegroundColor DarkCyan
    Write-Host "  Ctrl+Alt+Shift+M  =  allow cursor on the TV display (press again to re-lock)" -ForegroundColor DarkCyan
    Write-Host "  Ctrl+Alt+Shift+C  =  center cursor on the monitor it is on" -ForegroundColor DarkCyan
    Write-Host "  Public TV: no mirrored cursor until M unlocks (real cursor on TV only while unlocked)" -ForegroundColor DarkCyan
}
