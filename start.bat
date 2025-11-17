@echo off
title Dev Battle Arena - Lancement
echo ========================================
echo    DDEV BATTLE ARENA - DEMARRAGE
echo ========================================
echo.

:: Démarrage du serveur backend dans une nouvelle fenêtre
start "Backend Server" cmd /k "cd /d C:\laragon\www\Dev_battle_arena\backend && node index.js"

:: Attente de quelques secondes pour laisser le backend démarrer
echo.
echo Attente de 3 secondes...
timeout /t 3 /nobreak >nul

:: Démarrage du frontend dans une nouvelle fenêtre
start "Frontend" cmd /k "cd /d C:\laragon\www\Dev_battle_arena\frontend && npm run dev"

:: Affichage des URLs et instructions
echo.
echo ========================================
echo    SERVEURS DEMARRES !
echo ========================================
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Pour fermer les serveurs, fermez simplement les fenêtres de console correspondantes.
echo Appuyez sur une touche pour fermer ce message...
pause >nul