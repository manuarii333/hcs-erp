' Lance le serveur Dropbox HCS en arrière-plan (sans fenêtre visible)
Set WShell = CreateObject("WScript.Shell")
WShell.Run "pythonw """ & WScript.ScriptDir & "\dropbox-folder-server.py""", 0, False
