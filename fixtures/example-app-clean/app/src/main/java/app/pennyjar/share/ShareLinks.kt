package app.pennyjar.share

import android.util.Base64
import app.pennyjar.sync.ApiClient
import java.security.SecureRandom
import java.time.YearMonth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ShareLinks(private val api: ApiClient) {

    private val random = SecureRandom()

    suspend fun create(month: YearMonth): String = withContext(Dispatchers.IO) {
        val bytes = ByteArray(TOKEN_BYTES).also(random::nextBytes)
        val token = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        api.createShareLink(month.toString(), token)
        "$SHARE_BASE$token"
    }

    private companion object {
        const val SHARE_BASE = "https://share.pennyjar.example/r/"
        const val TOKEN_BYTES = 16
    }
}
