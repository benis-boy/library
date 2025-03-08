Set WshShell = CreateObject("WScript.Shell")
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
strPath = Replace(WScript.ScriptFullName, ".vbs", ".bat")

' Get the batch filename without the full path
strBatFile = Mid(strPath, InStrRev(strPath, "\") + 1)

' Find and kill any running `python.exe` instances executing this batch file
Set colProcesses = objWMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name='python.exe'")

For Each objProcess In colProcesses
    ' Get the command line and check if it contains the batch filename
    If Not IsNull(objProcess.CommandLine) Then
        If InStr(LCase(objProcess.CommandLine), "http.server 8000") > 0 Then
            objProcess.Terminate ' Kill old instance
        End If
    End If
Next

' Start new instance silently
WshShell.Run strPath, 0, False
