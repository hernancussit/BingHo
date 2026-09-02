# Script para compilar BingHo a un único archivo ejecutable portable .EXE con icono personalizado
$ErrorActionPreference = "Stop"

Write-Host ">>> Paso 1: Generando empaquetado base de Electron (BingHo)..." -ForegroundColor Cyan
& "C:\Program Files\nodejs\npm.cmd" run package:win

$distPath = "dist\BingHo-win32-x64"
$zipPath = "dist\app_payload.zip"
$portableExe = "dist\BingHo.exe"
$sourceFile = "dist\Launcher.cs"
$iconPath = "icon.ico"
$buildId = [Guid]::NewGuid().ToString()

Write-Host ">>> Paso 2: Creando archivo comprimido de la aplicación..." -ForegroundColor Cyan
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$distPath\*" -DestinationPath $zipPath -CompressionLevel Fastest -Force

Write-Host ">>> Paso 3: Generando código del lanzador portable autónomo (Build ID: $buildId)..." -ForegroundColor Cyan
$csharpCode = @"
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

namespace BingHo
{
    static class Program
    {
        private const string CURRENT_BUILD_ID = "$buildId";

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string targetDir = Path.Combine(localApp, "BingHoApp");
                string exePath = Path.Combine(targetDir, "BingHo.exe");
                string versionFile = Path.Combine(targetDir, ".build_id");

                bool needsExtract = true;
                if (Directory.Exists(targetDir) && File.Exists(exePath) && File.Exists(versionFile))
                {
                    try
                    {
                        string installedId = File.ReadAllText(versionFile).Trim();
                        if (installedId == CURRENT_BUILD_ID)
                        {
                            needsExtract = false;
                        }
                    }
                    catch { }
                }

                if (needsExtract)
                {
                    if (Directory.Exists(targetDir))
                    {
                        try { Directory.Delete(targetDir, true); } catch { }
                    }
                    Directory.CreateDirectory(targetDir);

                    Assembly asm = Assembly.GetExecutingAssembly();
                    using (Stream stream = asm.GetManifestResourceStream("app_payload.zip"))
                    {
                        if (stream == null)
                        {
                            MessageBox.Show("No se encontró el recurso embebido de la aplicación.", "Error BingHo", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            return;
                        }

                        string tempZip = Path.Combine(targetDir, "temp.zip");
                        using (FileStream fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                        {
                            stream.CopyTo(fs);
                        }

                        ZipFile.ExtractToDirectory(tempZip, targetDir);
                        try { File.Delete(tempZip); } catch { }
                        File.WriteAllText(versionFile, CURRENT_BUILD_ID);
                    }
                }

                if (File.Exists(exePath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = exePath;
                    psi.WorkingDirectory = targetDir;
                    psi.Arguments = string.Join(" ", args);
                    psi.UseShellExecute = false;

                    Process.Start(psi);
                }
                else
                {
                    MessageBox.Show("No se pudo ubicar el ejecutable principal en: " + exePath, "Error BingHo", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error al iniciar BingHo: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
"@

Set-Content -Path $sourceFile -Value $csharpCode -Encoding UTF8

Write-Host ">>> Paso 4: Compilando ejecutable único portable con icono (.ICO) mediante csc.exe..." -ForegroundColor Cyan
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$arguments = @(
    "/target:winexe",
    "/out:$portableExe",
    "/win32icon:$iconPath",
    "/resource:$zipPath,app_payload.zip",
    "/reference:System.dll",
    "/reference:System.Windows.Forms.dll",
    "/reference:System.IO.Compression.dll",
    "/reference:System.IO.Compression.FileSystem.dll",
    "/optimize+",
    $sourceFile
)

& $cscPath $arguments

if (Test-Path $portableExe) {
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item $sourceFile -Force -ErrorAction SilentlyContinue
    $sizeMb = [Math]::Round(((Get-Item $portableExe).Length / 1MB), 2)
    Write-Host ">>> ¡EXITO! Ejecutable portable BingHo.exe generado en: $portableExe ($sizeMb MB)" -ForegroundColor Green
} else {
    Write-Host ">>> Error al compilar el ejecutable portable." -ForegroundColor Red
}
