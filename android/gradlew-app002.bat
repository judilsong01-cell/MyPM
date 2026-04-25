@echo off
setlocal

REM Keep Gradle caches inside the workspace to avoid permission/profile issues.
set "GRADLE_USER_HOME=%~dp0..\..\.gradle"

REM Prefer a local JDK 17 to avoid Gradle toolchain downloads and JBR quirks.
if exist "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot"
) else if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)
if not "%JAVA_HOME%"=="" (
  set "PATH=%JAVA_HOME%\bin;%PATH%"
  set "ORG_GRADLE_JAVA_HOME=%JAVA_HOME%"
)

call "%~dp0gradlew.bat" %*
