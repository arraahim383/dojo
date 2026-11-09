Add-Type -AssemblyName System.Drawing

$resRoot = Join-Path $PSScriptRoot '..\android\app\src\main\res'
$pine = [System.Drawing.ColorTranslator]::FromHtml('#173d32')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#0c0a09')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#f3eedf')
$gold = [System.Drawing.ColorTranslator]::FromHtml('#d7b56d')

function Draw-BrandMark($graphics, [single]$x, [single]$y, [single]$size, [bool]$withBackground = $true, [bool]$round = $false) {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($withBackground) {
    $brush = [System.Drawing.SolidBrush]::new($pine)
    if ($round) {
      $graphics.FillEllipse($brush, $x, $y, $size, $size)
    } else {
      $radius = $size * 0.22
      $shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
      $shape.AddArc($x, $y, $radius * 2, $radius * 2, 180, 90)
      $shape.AddArc($x + $size - $radius * 2, $y, $radius * 2, $radius * 2, 270, 90)
      $shape.AddArc($x + $size - $radius * 2, $y + $size - $radius * 2, $radius * 2, $radius * 2, 0, 90)
      $shape.AddArc($x, $y + $size - $radius * 2, $radius * 2, $radius * 2, 90, 90)
      $shape.CloseFigure()
      $graphics.FillPath($brush, $shape)
      $shape.Dispose()
    }
    $brush.Dispose()
  }

  $scale = $size / 100.0
  $sx = { param($n) [single]($x + $n * $scale) }
  $sy = { param($n) [single]($y + $n * $scale) }
  $left = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$sx 16), (&$sy 31)),
    [System.Drawing.PointF]::new((&$sx 38), (&$sy 34)),
    [System.Drawing.PointF]::new((&$sx 50), (&$sy 42)),
    [System.Drawing.PointF]::new((&$sx 50), (&$sy 76)),
    [System.Drawing.PointF]::new((&$sx 38), (&$sy 68)),
    [System.Drawing.PointF]::new((&$sx 16), (&$sy 64))
  )
  $right = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((&$sx 84), (&$sy 31)),
    [System.Drawing.PointF]::new((&$sx 62), (&$sy 34)),
    [System.Drawing.PointF]::new((&$sx 50), (&$sy 42)),
    [System.Drawing.PointF]::new((&$sx 50), (&$sy 76)),
    [System.Drawing.PointF]::new((&$sx 62), (&$sy 68)),
    [System.Drawing.PointF]::new((&$sx 84), (&$sy 64))
  )
  $pageBrush = [System.Drawing.SolidBrush]::new($paper)
  $graphics.FillPolygon($pageBrush, $left)
  $graphics.FillPolygon($pageBrush, $right)
  $pageBrush.Dispose()

  $spinePen = [System.Drawing.Pen]::new($pine, [single]([Math]::Max(1.5, $size * 0.025)))
  $spinePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $spinePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($spinePen, (&$sx 50), (&$sy 42), (&$sx 50), (&$sy 76))
  $graphics.DrawLine($spinePen, (&$sx 20), (&$sy 45), (&$sx 40), (&$sy 48))
  $graphics.DrawLine($spinePen, (&$sx 80), (&$sy 45), (&$sx 60), (&$sy 48))
  $spinePen.Dispose()

  $accentPen = [System.Drawing.Pen]::new($gold, [single]([Math]::Max(2, $size * 0.045)))
  $accentPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $accentPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($accentPen, (&$sx 36), (&$sy 24), (&$sx 64), (&$sy 24))
  $accentPen.Dispose()
  $accentBrush = [System.Drawing.SolidBrush]::new($gold)
  $dot = [single]($size * 0.075)
  $graphics.FillEllipse($accentBrush, (&$sx (50 - ($dot / $scale / 2))), (&$sy (13 - ($dot / $scale / 2))), $dot, $dot)
  $accentBrush.Dispose()
}

function Save-LauncherPng([string]$path, [int]$pixels, [bool]$round, [bool]$foregroundOnly = $false) {
  $bitmap = [System.Drawing.Bitmap]::new($pixels, $pixels, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  if (-not $foregroundOnly) {
    $background = [System.Drawing.SolidBrush]::new($pine)
    if ($round) { $graphics.FillEllipse($background, 0, 0, $pixels, $pixels) }
    else { $graphics.FillRectangle($background, 0, 0, $pixels, $pixels) }
    $background.Dispose()
  }
  $markSize = if ($foregroundOnly) { [single]($pixels * 0.78) } else { [single]($pixels * 0.78) }
  $offset = [single](($pixels - $markSize) / 2)
  Draw-BrandMark $graphics $offset $offset $markSize $false $false
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

foreach ($scale in @(
  @{ name = 'mipmap-mdpi'; size = 48 },
  @{ name = 'mipmap-hdpi'; size = 72 },
  @{ name = 'mipmap-xhdpi'; size = 96 },
  @{ name = 'mipmap-xxhdpi'; size = 144 },
  @{ name = 'mipmap-xxxhdpi'; size = 192 }
)) {
  $dir = Join-Path $resRoot $scale.name
  Save-LauncherPng (Join-Path $dir 'ic_launcher.png') $scale.size $false
  Save-LauncherPng (Join-Path $dir 'ic_launcher_round.png') $scale.size $true
}

Get-ChildItem -Path $resRoot -Filter 'splash.png' -Recurse | ForEach-Object {
  $source = [System.Drawing.Image]::FromFile($_.FullName)
  $width = $source.Width
  $height = $source.Height
  $source.Dispose()
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear($ink)
  $markSize = [single]([Math]::Min(150, [Math]::Min($width * 0.32, $height * 0.34)))
  Draw-BrandMark $graphics ([single](($width - $markSize) / 2)) ([single](($height - $markSize) / 2 - $height * 0.07)) $markSize $true $false
  $fontSize = [single]([Math]::Max(14, [Math]::Min(30, $height * 0.07)))
  $font = [System.Drawing.Font]::new('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $textBrush = [System.Drawing.SolidBrush]::new($paper)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = [System.Drawing.RectangleF]::new(0, [single]($height / 2 + $markSize * 0.38), $width, [single]($fontSize * 1.8))
  $graphics.DrawString('DABA DOJO', $font, $textBrush, $rect, $format)
  $bitmap.Save($_.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
  $format.Dispose()
  $textBrush.Dispose()
  $font.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output 'Generated Daba Dojo launcher and splash artwork.'
