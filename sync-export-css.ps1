# 将 css/style.css 同步到 js/export-css.js（修改样式后运行一次）
$base = Split-Path $PSScriptRoot -Parent
$css = [System.IO.File]::ReadAllText("$base\css\style.css", [System.Text.Encoding]::UTF8)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('/**')
[void]$sb.AppendLine(' * 打包回退样式（与 css/style.css 同步）')
[void]$sb.AppendLine(' * @file export-css.js')
[void]$sb.AppendLine(' */')
[void]$sb.Append('const EXPORT_CSS = ')
[void]$sb.Append(($css | ConvertTo-Json -Compress))
[void]$sb.AppendLine(';')
[System.IO.File]::WriteAllText("$base\js\export-css.js", $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host '已更新 js/export-css.js'
