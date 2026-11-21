package app.pennyjar.support

import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

class SupportClient {

    private val client = OkHttpClient()

    suspend fun submit(email: String, subject: String, message: String) = withContext(Dispatchers.IO) {
        val ticket = JSONObject()
            .put("subject", subject)
            .put("requester", JSONObject().put("email", email))
            .put("comment", JSONObject().put("body", message))
            .put("tags", JSONArray().put("android"))
        val request = Request.Builder()
            .url(TICKETS_URL)
            .header("Authorization", "Bearer $HELPDESK_API_TOKEN")
            .post(JSONObject().put("ticket", ticket).toString().toRequestBody(JSON))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Ticket not created: ${response.code}")
        }
    }

    private companion object {
        const val TICKETS_URL = "https://pennyjar.helpdesk.example/api/v2/tickets"
        const val HELPDESK_API_TOKEN = "hdk.4Tq9vXm2Lr7Wc8Np3Zs6Yb1Jf5Hd0Ga"
        val JSON = "application/json; charset=utf-8".toMediaType()
    }
}
