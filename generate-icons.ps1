# Generate Ms Glow POS PWA icons (soft pink flower theme)
Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  # Background gradient-ish soft pink
  $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 209, 220))
  $g.FillRectangle($bgBrush, 0, 0, $size, $size)

  # Deep pink circle center
  $circleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 231, 84, 128))
  $cx = $size / 2.0; $cy = $size / 2.0; $r = $size * 0.38
  $g.FillEllipse($circleBrush, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2))

  # Flower emoji text
  $fontSize = [int]($size * 0.42)
  $font = New-Object System.Drawing.Font('Segoe UI Emoji', $fontSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, ($cy - $r), $size, ($r * 2))
  $g.DrawString([char]0xD83C + [char]0xDF38, $font, $whiteBrush, $rect, $sf)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "Created: $path ($size px)"
}

New-Icon 192 "$PSScriptRoot\icons\icon-192.png"
New-Icon 512 "$PSScriptRoot\icons\icon-512.png"
Write-Host "Done."
