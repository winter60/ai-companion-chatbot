@echo off
echo Running project tests...
echo.

echo [1/5] Testing usage limits...
node scripts/tests/test-usage-limits.js

echo.
echo [2/5] Testing guest flow...
node scripts/tests/test-guest-flow.js

echo.
echo [3/5] Testing device fingerprint...
node scripts/tests/test-device-fingerprint.js

echo.
echo [4/5] Testing user status...
node scripts/tests/test-user-status.js

echo.
echo [5/5] Testing reset functionality...
node scripts/tests/test-reset-fix.js

echo.
echo All tests completed!
pause