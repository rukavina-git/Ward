package app.pennyjar.share

import app.pennyjar.sync.ApiClient
import java.time.YearMonth
import java.util.Random
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ShareLinks(private val api: ApiClient) {

    private val random = Random()

    suspend fun create(month: YearMonth): String = withContext(Dispatchers.IO) {
        val token = buildString {
            repeat(TOKEN_LENGTH) { append(ALPHABET[random.nextInt(ALPHABET.length)]) }
        }
        api.createShareLink(month.toString(), token)
        "$SHARE_BASE$token"
    }

    private companion object {
        const val SHARE_BASE = "https://share.pennyjar.example/r/"
        const val ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"
        const val TOKEN_LENGTH = 12
    }
}
