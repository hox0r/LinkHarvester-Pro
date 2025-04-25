@echo off
echo Setting up LinkHarvester Pro for GitHub...

REM Initialize git repository
git init

REM Add all files to git
git add .

REM Initial commit
git commit -m "Initial commit of LinkHarvester Pro"

echo.
echo Repository initialized locally. Now you need to:
echo 1. Create a new repository on GitHub named 'LinkHarvester-Pro'
echo 2. Run the following commands to push to GitHub:
echo.
echo git remote add origin https://github.com/hox0r/LinkHarvester-Pro.git
echo git branch -M main
echo git push -u origin main
echo.
echo Press any key to open GitHub to create a new repository...
pause > nul
start https://github.com/new

echo.
echo After creating the repository on GitHub, would you like to run the commands to push your code? (Y/N)
set /p choice=
if /i "%choice%"=="Y" (
    git remote add origin https://github.com/hox0r/LinkHarvester-Pro.git
    git branch -M main
    git push -u origin main
    echo Repository pushed to GitHub successfully!
) else (
    echo You can manually run the commands listed above when ready.
)

echo.
echo Setup complete!
pause 