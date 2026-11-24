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

    fun rememberedEmail(): String? = credentials.email()

    suspend fun signIn(email: String, password: String, remember: Boolean): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val session = api.login(email, password)
                tokens.save(session.token)
                if (remember) credentials.saveEmail(email) else credentials.clear()
                analytics.signedIn(session.userId)
            }
        }

    suspend fun createAccount(name: String, email: String, password: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val session = api.register(name, email, password)
                tokens.save(session.token)
                analytics.signedIn(session.userId)
            }
        }

    suspend fun restoreSession(): Boolean = withContext(Dispatchers.IO) {
        tokens.read() != null
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        runCatching { api.logout() }
        tokens.clear()
        credentials.clear()
        analytics.signedOut()
    }

    suspend fun deleteAccount(): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            api.deleteAccount()
            tokens.clear()
            credentials.clear()
            analytics.signedOut()
        }
    }
}
