# 크롬이 백그라운드에서 자동 업데이트되면 Selenium이 캐시해둔 chromedriver 버전과
# 어긋나서 "invalid argument" 에러로 매장정보 크롤링이 실패한다(2026-09-04에 실제로
# 발생 — 크롬 151.0.7922.173로 자동업데이트됐는데 캐시된 드라이버는 .138/.77이었음).
# 이 스크립트는 설치된 크롬 버전과 캐시된 chromedriver 버전을 비교해서, 안 맞으면
# 캐시를 지워 Selenium이 다음 실행 때 맞는 버전을 새로 받게 한다 — Windows 작업
# 스케줄러로 매일 돌리면 이 문제가 다시 생겨도 admin이 크롤링 시도하기 전에
# 자동으로 고쳐져 있다.

$ErrorActionPreference = 'Stop'
$logFile = Join-Path $env:USERPROFILE '.cache\selenium\chromedriver-check.log'
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null

function Write-Log($message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $message"
    Add-Content -Path $logFile -Value $line
    Write-Output $line
}

$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chromeExe) {
    Write-Log "크롬 실행파일을 못 찾음 — 확인 건너뜀"
    exit 0
}

$chromeVersion = (Get-Item $chromeExe).VersionInfo.ProductVersion
Write-Log "설치된 크롬 버전: $chromeVersion"

$driverRoot = Join-Path $env:USERPROFILE '.cache\selenium\chromedriver\win64'
if (-not (Test-Path $driverRoot)) {
    Write-Log "캐시된 chromedriver 없음 — 다음 크롤링 때 Selenium이 알아서 받음(정상)"
    exit 0
}

$cachedVersions = Get-ChildItem $driverRoot -Directory | Select-Object -ExpandProperty Name
$matching = $cachedVersions | Where-Object { $_ -eq $chromeVersion }

if ($matching) {
    Write-Log "일치하는 chromedriver($chromeVersion) 이미 캐시돼있음 — 문제 없음"
    exit 0
}

Write-Log "일치하는 chromedriver 없음 (캐시: $($cachedVersions -join ', ')) — 안 맞는 버전 전부 삭제, 다음 크롤링 때 새로 받게 함"
foreach ($dir in $cachedVersions) {
    Remove-Item -Recurse -Force (Join-Path $driverRoot $dir)
    Write-Log "삭제: $dir"
}
Write-Log "정리 완료"
