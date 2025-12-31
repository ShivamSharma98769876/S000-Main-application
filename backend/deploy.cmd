@if "%SCM_TRACE_LEVEL%" NEQ "4" @echo off

:: ----------------------
:: KUDU Deployment Script
:: Version: 1.0.17
:: ----------------------

:: Prerequisites
:: -------------

:: Verify node.js installed
where node 2>nul >nul
if %ERRORLEVEL% NEQ 0 (
  echo Missing node.js executable. Please install node.js, if it is already installed make sure it can be reached from current environment.
  goto error
)

:: Setup
:: -----

setlocal enabledelayedexpansion

SET ARTIFACTS=%~dp0%..\artifacts

IF NOT DEFINED DEPLOYMENT_SOURCE (
  SET DEPLOYMENT_SOURCE=%~dp0%.
)

IF NOT DEFINED DEPLOYMENT_TARGET (
  SET DEPLOYMENT_TARGET=%ARTIFACTS%\wwwroot
)

IF NOT DEFINED NEXT_MANIFEST_PATH (
  SET NEXT_MANIFEST_PATH=%ARTIFACTS%\manifest

  IF NOT DEFINED PREVIOUS_MANIFEST_PATH (
    SET PREVIOUS_MANIFEST_PATH=%ARTIFACTS%\manifest
  )
)

IF NOT DEFINED KUDU_SYNC_CMD (
  :: Install kudu sync
  echo Installing Kudu Sync
  call npm install kudusync -g --silent
  IF !ERRORLEVEL! NEQ 0 goto error

  :: Locally just run "kudu sync" but in the cloud we'll use kuduSync
  SET KUDU_SYNC_CMD=%appdata%\npm\kudusync.cmd
)

IF NOT DEFINED IN_PLACE_DEPLOYMENT (
  SET IN_PLACE_DEPLOYMENT=1
)

IF NOT DEFINED POST_DEPLOYMENT_ACTION (
  SET POST_DEPLOYMENT_ACTION=""
)

IF NOT DEFINED SKIP_NODE_MODULES (
  SET SKIP_NODE_MODULES=0
)

IF NOT DEFINED NPM_CMD (
  :: Install npm packages
  where npm 2>nul >nul
  if %ERRORLEVEL% NEQ 0 (
    echo Missing npm executable. Please install npm, if it is already installed make sure it can be reached from current environment.
    goto error
  )
  SET NPM_CMD=!npm!
)

::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
:: Deployment
:: -----------

echo Handling node.js deployment.

:: 1. KuduSync (exclude database files and data directory)
IF /I "%IN_PLACE_DEPLOYMENT%" NEQ "1" (
  call :ExecuteCmd "%KUDU_SYNC_CMD%" -v 50 -f "%DEPLOYMENT_SOURCE%" -t "%DEPLOYMENT_TARGET%" -n "%NEXT_MANIFEST_PATH%" -p "%PREVIOUS_MANIFEST_PATH%" -i ".git;.hg;.deployment;deploy.cmd;*.db;*.db-shm;*.db-wal;*.sqlite;*.sqlite3;data/"
  IF !ERRORLEVEL! NEQ 0 goto error
)

:: 2. Select node version
call :SelectNodeVersion

:: 3. Install npm packages
IF /I "%SKIP_NODE_MODULES%" NEQ "1" (
  pushd "%DEPLOYMENT_TARGET%"
  call :ExecuteCmd !NPM_CMD! install --production
  IF !ERRORLEVEL! NEQ 0 goto error
  popd
)

:: 4. Create data directory for database files (if it doesn't exist)
IF NOT EXIST "%DEPLOYMENT_TARGET%\data" (
  echo Creating data directory for database files...
  mkdir "%DEPLOYMENT_TARGET%\data"
  IF !ERRORLEVEL! NEQ 0 (
    echo Warning: Failed to create data directory, but continuing...
  ) ELSE (
    echo Data directory created successfully.
  )
)

::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
goto end

:: Utility Functions
:: -----------------

:SelectNodeVersion
IF EXIST "%DEPLOYMENT_TARGET%\.nvmrc" (
  set /p NODE_VERSION=<"%DEPLOYMENT_TARGET%\.nvmrc"
  call :ExecuteCmd !NPM_CMD! config set node-version !NODE_VERSION!
  IF !ERRORLEVEL! NEQ 0 goto error
)
goto :eof

:ExecuteCmd
setlocal
set _CMD_=%*
call %_CMD_%
if %ERRORLEVEL% NEQ 0 goto error
goto :eof

:error
endlocal
echo An error has occurred during web site deployment.
call :exitSetErrorLevel
call :exitFromFunction 2>nul

:exitSetErrorLevel
exit /b 1

:exitFromFunction
()

:end
endlocal
echo Finished successfully.

