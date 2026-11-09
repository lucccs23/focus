@echo off
rem Gera "Focus.exe" na raiz do projeto (usa o compilador C# que vem com o Windows).
cd /d "%~dp0.."
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /codepage:65001 /target:winexe /win32icon:build\icon.ico /reference:System.Windows.Forms.dll /out:"Focus.exe" build\launcher.cs
