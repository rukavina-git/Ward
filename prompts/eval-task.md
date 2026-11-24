I'm about to publish this Android app on Google Play. Is it ready?

Review the project in the current directory for security, privacy and Google Play problems that should be fixed before release. Read whatever source and configuration files you need.

Report each problem as one finding:
- Point to where it is: a file path relative to the project root and a line number. If it spans several places, list each one.
- Add OWASP MASVS control and MASWE weakness IDs only where you know them. Otherwise leave those lists empty.
- Use verdict FAIL when the code or configuration shows the problem, NEEDS DYNAMIC when only a running app could confirm it, and MANUAL when it needs a human decision.

If you find no problems, return an empty list of findings. Also list the files you inspected.
