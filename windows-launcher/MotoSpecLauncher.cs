// MotoSPEC Windows launcher — a single-file exe that serves the app from
// embedded resources over 127.0.0.1 and opens the default browser.
//
// The app is plain ES modules and must be served over HTTP (file:// won't
// load modules), so the exe embeds index.html + src/*.js + data/*.json as
// managed resources at build time (see build.ps1) and runs a minimal HTTP
// server on a loopback ephemeral port. TcpListener is used instead of
// HttpListener because http.sys URL reservations require admin rights.
//
// Compiled with the C# 5 compiler that ships inside Windows
// (C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe) — no SDK,
// no NuGet, no runtime to install. Rebuild with windows-launcher\build.ps1
// whenever index.html / src / data change.

using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;

static class MotoSpecLauncher
{
    static readonly Dictionary<string, string> Mime = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { ".html", "text/html; charset=utf-8" },
        { ".js",   "text/javascript; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".css",  "text/css; charset=utf-8" },
        { ".svg",  "image/svg+xml" },
        { ".png",  "image/png" },
        { ".ico",  "image/x-icon" },
    };

    static Assembly Asm;

    static void Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        Asm = Assembly.GetExecutingAssembly();

        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        string url = string.Format("http://127.0.0.1:{0}/", port);

        Console.WriteLine("MotoSPEC Formula Explorer");
        Console.WriteLine("Serving at " + url);
        Console.WriteLine();
        Console.WriteLine("Keep this window open while using the app.");
        Console.WriteLine("使用期间请保持本窗口开启；关闭本窗口即退出。");

        try { System.Diagnostics.Process.Start(url); }
        catch (Exception) { Console.WriteLine("Open this URL manually: " + url); }

        while (true)
        {
            TcpClient client = listener.AcceptTcpClient();
            ThreadPool.QueueUserWorkItem(Handle, client);
        }
    }

    static void Handle(object state)
    {
        var client = (TcpClient)state;
        try
        {
            client.ReceiveTimeout = 5000;
            using (var stream = client.GetStream())
            {
                string requestLine = ReadRequestLine(stream);
                if (requestLine == null) return;
                DrainHeaders(stream);

                string[] parts = requestLine.Split(' ');
                if (parts.Length < 2 || (parts[0] != "GET" && parts[0] != "HEAD"))
                {
                    WriteResponse(stream, "405 Method Not Allowed", "text/plain", Encoding.UTF8.GetBytes("405"), false);
                    return;
                }

                string path = parts[1];
                int q = path.IndexOf('?');
                if (q >= 0) path = path.Substring(0, q);
                path = Uri.UnescapeDataString(path).TrimStart('/');
                if (path.Length == 0) path = "index.html";

                // Resource names mirror repo-relative paths ("src/formulas.js").
                // Reject traversal outright — everything served is embedded anyway.
                if (path.Contains(".."))
                {
                    WriteResponse(stream, "400 Bad Request", "text/plain", Encoding.UTF8.GetBytes("400"), false);
                    return;
                }

                byte[] body = ReadResource(path);
                if (body == null)
                {
                    WriteResponse(stream, "404 Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("404 — " + path), false);
                    return;
                }

                string ext = Path.GetExtension(path);
                string mime;
                if (!Mime.TryGetValue(ext, out mime)) mime = "application/octet-stream";
                WriteResponse(stream, "200 OK", mime, body, parts[0] == "HEAD");
            }
        }
        catch (Exception) { /* connection reset etc. — ignore */ }
        finally { client.Close(); }
    }

    static byte[] ReadResource(string name)
    {
        using (Stream s = Asm.GetManifestResourceStream(name))
        {
            if (s == null) return null;
            using (var ms = new MemoryStream())
            {
                s.CopyTo(ms);
                return ms.ToArray();
            }
        }
    }

    static string ReadRequestLine(Stream stream)
    {
        var sb = new StringBuilder();
        int b;
        while ((b = stream.ReadByte()) != -1)
        {
            if (b == '\n') return sb.ToString().TrimEnd('\r');
            sb.Append((char)b);
            if (sb.Length > 8192) return null;
        }
        return null;
    }

    static void DrainHeaders(Stream stream)
    {
        // Read until the blank line that ends the header block.
        int blank = 0;
        int b;
        while ((b = stream.ReadByte()) != -1)
        {
            if (b == '\n') { blank++; if (blank == 2) return; }
            else if (b != '\r') blank = 0;
        }
    }

    static void WriteResponse(Stream stream, string status, string mime, byte[] body, bool headOnly)
    {
        string header = "HTTP/1.1 " + status + "\r\n" +
                        "Content-Type: " + mime + "\r\n" +
                        "Content-Length: " + body.Length + "\r\n" +
                        "Cache-Control: no-cache\r\n" +
                        "Connection: close\r\n\r\n";
        byte[] hb = Encoding.ASCII.GetBytes(header);
        stream.Write(hb, 0, hb.Length);
        if (!headOnly) stream.Write(body, 0, body.Length);
        stream.Flush();
    }
}
