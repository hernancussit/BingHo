# Script para compilar BingHo a un único archivo ejecutable portable .EXE con icono y metadatos completos
$ErrorActionPreference = "Stop"

# Cerrar cualquier instancia previa en ejecución para liberar archivos
Stop-Process -Name "BingHo" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

Write-Host ">>> Paso 1: Actualizando build y empaquetando base de Electron..." -ForegroundColor Cyan

$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$buildNumber = if ($pkg.buildNumber) { [int]$pkg.buildNumber + 1 } else { 1 }
$buildTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$pkg.buildNumber = $buildNumber
$pkg.buildTimestamp = $buildTimestamp

# Guardar package.json actualizado con el nuevo build antes de empaquetar
$pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8

$appVersion = $pkg.version
$cleanVer = ($appVersion -split '-')[0]
$assemblyVer = if ($cleanVer -match '^\d+\.\d+\.\d+$') { "$cleanVer.$buildNumber" } else { "1.0.0.$buildNumber" }

& "C:\Program Files\nodejs\npx.cmd" -y @electron/packager . "BingHo" --platform=win32 --arch=x64 --icon=icon.ico --out=dist --overwrite --prune=true --ignore="^/dist" --ignore="^/scratch" --ignore="\.git" "--app-version=$cleanVer.$buildNumber" "--build-version=$cleanVer.$buildNumber" '--win32metadata.CompanyName=BingHo' '--win32metadata.FileDescription=BingHo - Sistema Profesional para Tableros de Bingo' '--win32metadata.ProductName=BingHo'
Start-Sleep -Seconds 1

$distPath = "dist\BingHo-win32-x64"
$zipPath = "dist\app_payload.zip"
$portableExe = "dist\BingHo.exe"
$releaseZip = "dist\BingHo-v$appVersion-Windows-x64.zip"
$sourceFile = "dist\Launcher.cs"
$iconPath = "icon.ico"
$buildId = [Guid]::NewGuid().ToString()

Write-Host ">>> Paso 2: Optimizando y limpiando recursos innecesarios del empaquetado..." -ForegroundColor Cyan
# Limpiar locales sobrantes (conservar es, es-419, en-US, en-GB)
$localesPath = Join-Path $distPath "locales"
if (Test-Path $localesPath) {
    Get-ChildItem -Path $localesPath -Filter "*.pak" | Where-Object {
        $_.Name -notmatch '^(es|es-419|en-US|en-GB)\.pak$'
    } | Remove-Item -Force
}
# Eliminar archivo de licencias HTML voluminoso
$licensesHtml = Join-Path $distPath "LICENSES.chromium.html"
if (Test-Path $licensesHtml) { Remove-Item $licensesHtml -Force }

Write-Host ">>> Paso 3: Creando archivo comprimido de alta densidad..." -ForegroundColor Cyan
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$distPath\*" -DestinationPath $zipPath -CompressionLevel Optimal -Force

Write-Host ">>> Paso 4: Generando código del lanzador portable con metadatos completos de Windows (Build ID: $buildId, Ver: $assemblyVer)..." -ForegroundColor Cyan
$csharpCode = @"
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

[assembly: AssemblyTitle("BingHo")]
[assembly: AssemblyDescription("BingHo - Sistema Profesional para Tableros de Bingo en pantallas LED y proyección")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("BingHo")]
[assembly: AssemblyProduct("BingHo")]
[assembly: AssemblyCopyright("Copyright © 2026 Hernán Cussit")]
[assembly: AssemblyTrademark("BingHo")]
[assembly: AssemblyCulture("")]
[assembly: ComVisible(false)]
[assembly: AssemblyVersion("$assemblyVer")]
[assembly: AssemblyFileVersion("$assemblyVer")]

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
                    KillProcesses();
                    System.Threading.Thread.Sleep(250);

                    for (int retry = 0; retry < 5; retry++)
                    {
                        try
                        {
                            if (Directory.Exists(targetDir))
                            {
                                Directory.Delete(targetDir, true);
                            }
                            break;
                        }
                        catch
                        {
                            KillProcesses();
                            System.Threading.Thread.Sleep(350);
                        }
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
                    psi.EnvironmentVariables["BINGHO_PORTABLE_EXE"] = Assembly.GetExecutingAssembly().Location;

                    Process.Start(psi);
                }
                else
                {
                    MessageBox.Show("No se pudo ubicar el ejecutable principal en: " + exePath, "Error BingHo", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                DialogResult res = MessageBox.Show(
                    "Se produjo un problema al iniciar BingHo o los archivos se encuentran en uso por otra instancia abierta en segundo plano.\n\n" +
                    "Haz clic en 'Aceptar' (Cerrar) para terminar todos los procesos abiertos y vuelve a intentar iniciar la app de nuevo en unos segundos.\n\n" +
                    "Detalle: " + ex.Message,
                    "BingHo - Control de Procesos",
                    MessageBoxButtons.OKCancel,
                    MessageBoxIcon.Warning);

                if (res == DialogResult.OK)
                {
                    KillProcesses();
                }
            }
        }

        private static void KillProcesses()
        {
            try
            {
                int currentPid = Process.GetCurrentProcess().Id;
                Process[] procs = Process.GetProcessesByName("BingHo");
                foreach (var p in procs)
                {
                    if (p.Id != currentPid)
                    {
                        try { p.Kill(); p.WaitForExit(1000); } catch { }
                    }
                }
            }
            catch { }
        }
    }
}
"@

Set-Content -Path $sourceFile -Value $csharpCode -Encoding UTF8

Write-Host ">>> Paso 5: Compilando ejecutable único portable con icono y AssemblyInfo mediante csc.exe..." -ForegroundColor Cyan
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
    
    # Mantener solo la última build en dist: eliminar zips de builds anteriores para ahorrar espacio en disco
    Get-ChildItem -Path "dist" -Filter "BingHo-v*.zip" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    # Crear el paquete comprimido .ZIP para descargas de la última build
    Compress-Archive -Path $portableExe -DestinationPath $releaseZip -Force
    
    $sizeMb = [Math]::Round(((Get-Item $portableExe).Length / 1MB), 2)
    $zipMb = [Math]::Round(((Get-Item $releaseZip).Length / 1MB), 2)
    Write-Host ">>> ¡EXITO! Ejecutable portable BingHo.exe generado en: $portableExe ($sizeMb MB)" -ForegroundColor Green
    Write-Host ">>> ¡EXITO! Archivo ZIP de distribución generado en: $releaseZip ($zipMb MB)" -ForegroundColor Green
} else {
    Write-Host ">>> Error al compilar el ejecutable portable." -ForegroundColor Red
}
