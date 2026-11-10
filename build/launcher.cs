// Lançador do Focus: abre o app direto do código desta pasta (sem instalar).
// Usa runtime\Focus.exe (criado por "npm run runtime"), que aparece como "Focus" no Windows.
// Compilado com: build\make-launcher.cmd
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Focus")]
[assembly: AssemblyProduct("Focus")]
[assembly: AssemblyDescription("Pomodoro, cronômetro e estatísticas de estudo")]
[assembly: AssemblyVersion("1.3.0.0")]
[assembly: AssemblyFileVersion("1.3.0.0")]

static class Launcher
{
    [STAThread]
    static void Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        string runtime = Path.Combine(dir, @"runtime\Focus.exe");
        string electron = Path.Combine(dir, @"node_modules\electron\dist\electron.exe");

        ProcessStartInfo psi;
        if (File.Exists(runtime))
            psi = new ProcessStartInfo(runtime);
        else if (File.Exists(electron))
            psi = new ProcessStartInfo(electron, "\"" + dir + "\""); // funciona, mas aparece como "Electron"
        else
        {
            MessageBox.Show(
                "Não encontrei o Focus nesta pasta.\n\nAbra um terminal em:\n" + dir +
                "\n\ne rode:\n  npm install\n  node node_modules/electron/install.js\n  npm run runtime",
                "Focus", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        psi.WorkingDirectory = dir;
        psi.UseShellExecute = false;
        Process.Start(psi);
    }
}
