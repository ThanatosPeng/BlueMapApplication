using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

/// <summary>
/// BlueMap 启动器。
///
/// 为什么需要它：某些 Windows 环境里 Chromium 沙箱初始化会直接崩（退出码 0x80000003），
/// 而且崩在应用 JS 之前，所以带 `--no-sandbox` 的唯一办法就是在进程启动时传参。
///
/// 策略：
///   1. 先按正常参数启动 BlueMapCore.exe；
///   2. 2.5 秒后如果进程已经退出，判定沙箱不可用，写标记并改用 --no-sandbox 重启；
///   3. 之后每次启动都直接带 --no-sandbox，不再经历一次闪退。
/// </summary>
static class Program
{
    static int Main(string[] args)
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string core = Path.Combine(dir, "BlueMapCore.exe");
        if (!File.Exists(core))
        {
            return 1;
        }

        string stateDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BlueMap");
        string marker = Path.Combine(stateDir, "sandbox-unsupported");

        bool knownBroken = File.Exists(marker);

        // 显式指定数据目录：和主进程的候选顺序保持一致，避免落进程序目录
        string dataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BlueMap");
        try
        {
            Directory.CreateDirectory(dataDir);
            string probe = Path.Combine(dataDir, ".write-probe");
            File.WriteAllText(probe, "ok");
            File.Delete(probe);
        }
        catch
        {
            dataDir = null;
        }

        Process first = Start(core, knownBroken, args, dataDir);
        if (first == null)
        {
            return 1;
        }
        if (knownBroken)
        {
            return 0;
        }

        Thread.Sleep(2500);
        if (!first.HasExited)
        {
            return 0;
        }

        try
        {
            Directory.CreateDirectory(stateDir);
            File.WriteAllText(marker, DateTime.Now.ToString("o"));
        }
        catch
        {
            // 记不住就下次再试，不影响本次启动
        }

        Process second = Start(core, true, args, dataDir);
        return second == null ? 1 : 0;
    }

    static Process Start(string core, bool noSandbox, string[] args, string dataDir)
    {
        ProcessStartInfo info = new ProcessStartInfo();
        info.FileName = core;
        info.UseShellExecute = false;
        info.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;

        string arguments = noSandbox ? "--no-sandbox " : "";
        if (!string.IsNullOrEmpty(dataDir))
        {
            arguments += "--user-data-dir=\"" + dataDir + "\" ";
        }
        foreach (string arg in args)
        {
            arguments += "\"" + arg + "\" ";
        }
        info.Arguments = arguments;

        try
        {
            return Process.Start(info);
        }
        catch
        {
            return null;
        }
    }
}
