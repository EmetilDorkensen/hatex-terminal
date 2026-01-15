@echo off
set /p msg="Kisa ou chanje nan kod la? : "
git add .
git commit -m "%msg%"
git push origin main
echo ---------------------------------------
echo SIKSE! Chanjman yo ap monte sou Vercel...
echo ---------------------------------------
pause