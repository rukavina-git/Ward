---
name: masvs-checklist
description: Review an Android app against OWASP MASVS before release.
---

# MASVS checklist

Go through every group below. For each control, look at the code and
configuration that it applies to and decide whether the app meets it.
Report each problem with the file and line where it is.

## MASVS-STORAGE
- MASVS-STORAGE-1: The app securely stores sensitive data.
- MASVS-STORAGE-2: The app prevents leakage of sensitive data.

## MASVS-CRYPTO
- MASVS-CRYPTO-1: The app employs current strong cryptography and uses it according to industry best practices.
- MASVS-CRYPTO-2: The app performs key management according to industry best practices.

## MASVS-AUTH
- MASVS-AUTH-1: The app uses secure authentication and authorization protocols and follows the relevant best practices.
- MASVS-AUTH-2: The app performs local authentication securely according to the platform best practices.
- MASVS-AUTH-3: The app secures sensitive operations with additional authentication.

## MASVS-NETWORK
- MASVS-NETWORK-1: The app secures all network traffic according to the current best practices.
- MASVS-NETWORK-2: The app performs identity pinning for all remote endpoints under the developer's control.

## MASVS-PLATFORM
- MASVS-PLATFORM-1: The app uses IPC mechanisms securely.
- MASVS-PLATFORM-2: The app uses WebViews securely.
- MASVS-PLATFORM-3: The app uses the user interface securely.

## MASVS-CODE
- MASVS-CODE-1: The app requires an up-to-date platform version.
- MASVS-CODE-2: The app has a mechanism for enforcing app updates.
- MASVS-CODE-3: The app only uses software components without known vulnerabilities.
- MASVS-CODE-4: The app validates and sanitizes all untrusted inputs.

## MASVS-RESILIENCE
- MASVS-RESILIENCE-1: The app validates the integrity of the platform.
- MASVS-RESILIENCE-2: The app implements anti-tampering mechanisms.
- MASVS-RESILIENCE-3: The app implements anti-static analysis mechanisms.
- MASVS-RESILIENCE-4: The app implements anti-dynamic analysis techniques.

## MASVS-PRIVACY
- MASVS-PRIVACY-1: The app minimizes access to sensitive data and resources.
- MASVS-PRIVACY-2: The app prevents identification of the user.
- MASVS-PRIVACY-3: The app is transparent about data collection and usage.
- MASVS-PRIVACY-4: The app offers user control over their data.

---
Control statements from OWASP MASVS v2.1.0
(https://github.com/OWASP/masvs/tree/v2.1.0/controls), © OWASP
Foundation, licensed CC BY-SA 4.0
(https://creativecommons.org/licenses/by-sa/4.0/). Quoted without
changes. This file is shared under the same licence.
