---
status: accepted
---

# Keep Nitro Cookie sessions and hand browser authorization to the app by polling

The Flutter client supports the connected server's personal password, PAT, and GitHub OAuth providers while reusing the existing Nitro Cookie-session authority and CSRF contract. Keep all session establishment through `establishGitHubSession()`. Use Dio with cookie_jar/dio_cookie_manager, and protect persisted sensitive session credentials with flutter_secure_storage; the selected cookie-manager plugin does not by itself make a file-based jar secure.

GitHub OAuth continues through the system browser and existing server callback. Add a short-lived authorization transaction bound to the initiating app's verifier and backend origin. After the user returns to the app, it polls/redeems the approved transaction and receives its own session. Redemption must be single-use and atomic, with expiry and cancellation; browser cookies are not copied into a callback URL. Pause/resume this flow with app lifecycle rather than introducing a mobile background service.

An independent Bearer-session lifecycle was rejected to keep one authentication authority. OS-registered callback links were considered for automatic app return; polling instead covers arbitrary compatible self-hosted origins on all five platforms without separate URI-handler registration. It requires explicit browser-to-app switching and temporary transaction/polling state. No additional GitHub Device Flow or central callback service is selected.
