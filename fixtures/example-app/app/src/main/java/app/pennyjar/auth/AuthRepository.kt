package app.pennyjar.auth

import app.pennyjar.analytics.Analytics
import app.pennyjar.sync.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AuthRepository(
    private val api: ApiClient,
    private val tokens: TokenStore,
    private val credentials: CredentialStore,
    private val analytics: Analytics,
) {

    suspend fun signIn(email: String, password: String, remember: Boolean): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val session = api.login(email, password)
                tokens.save(session.token)
                if (remember) credentials.save(email, password) else credentials.clear()
                analytics.signedIn(email)
            }
        }

    suspend fun createAccount(name: String, email: String, password: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val session = api.register(name, email, password)
                tokens.save(session.token)
                analytics.signedIn(email)
            }
        }

    suspend fun restoreSession(): Boolean = withContext(Dispatchers.IO) {
        if (tokens.read() != null) return@withContext true
        val saved = credentials.load() ?: return@withContext false
        signIn(saved.email, saved.password, remember = true).isSuccess
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        runCatching { api.logout() }
        tokens.clear()
        credentials.clear()
        analytics.signedOut()
    }
}
