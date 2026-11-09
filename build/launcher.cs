// Lançador do Focus: abre o app direto do código desta pasta (sem instalar).
// Compilado com: build\make-launcher.cmd
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

static class Launcher
{
    [STAThread]
    static void Main()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        string electron = Path.Combine(dir, @"node_modules\electron\dist\electron.exe");
        if (!File.Exists(electron))
        {
            MessageBox.Show(
                "Não encontrei o Electron nesta pasta.\n\nAbra um terminal em:\n" + dir +
                "\n\ne rode:\n  npm install\n  node node_modules/electron/install.js",
                "Focus", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        var psi = new ProcessStartInfo(electron, "\"" + dir + "\"")
        {
            WorkingDirectory = dir,
            UseShellExecute = false,
        };
        Process.Start(psi);
    }
}
