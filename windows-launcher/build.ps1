# Build MotoSPEC.exe — embeds index.html + src/*.js + data/*.json into a
# single self-contained exe using the C# compiler that ships with Windows.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File windows-launcher\build.ps1
# Output: MotoSPEC.exe at the repo root. Rebuild after changing app files.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$csc  = "$env:windir\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { $csc = "$env:windir\Microsoft.NET\Framework\v4.0.30319\csc.exe" }
if (-not (Test-Path $csc)) { throw "csc.exe not found — .NET Framework 4.x is required (ships with Windows)." }

# Resource identifiers mirror repo-relative paths with forward slashes so the
# HTTP path maps 1:1 onto the resource name.
$files = @('index.html')
$files += Get-ChildItem "$repo\src\*.js"    | ForEach-Object { "src/$($_.Name)" }
$files += Get-ChildItem "$repo\data\*.json" | ForEach-Object { "data/$($_.Name)" }

$resArgs = $files | ForEach-Object { "/resource:`"$repo\$($_ -replace '/','\')`",$_" }

$out = "$repo\MotoSPEC.exe"
& $csc /nologo /target:exe /optimize+ "/out:$out" @resArgs "$PSScriptRoot\MotoSpecLauncher.cs"
if ($LASTEXITCODE -ne 0) { throw "csc failed with exit code $LASTEXITCODE" }

$size = [math]::Round((Get-Item $out).Length / 1KB)
Write-Host "Built $out ($size KB, $($files.Count) embedded files)"
