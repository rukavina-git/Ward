package app.pennyjar.sync

import app.pennyjar.sync.model.Created
import app.pennyjar.sync.model.LoginRequest
import app.pennyjar.sync.model.ReceiptBody
import app.pennyjar.sync.model.RegisterRequest
import app.pennyjar.sync.model.Session
import app.pennyjar.sync.model.ShareLinkRequest
import app.pennyjar.sync.model.SupportTicket
import com.google.gson.Gson
import java.io.File
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor

class ApiClient(tokenProvider: () -> String?) {

    private val gson = Gson()

    private val client = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(tokenProvider))
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                    redactHeader("Authorization")
                })
            }
        }
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    fun login(email: String, password: String): Session =
        post("auth/login", LoginRequest(email, password))

    fun register(name: String, email: String, password: String): Session =
        post("auth/register", RegisterRequest(name, email, password))

    fun logout() {
        send(request("auth/logout").post(EMPTY_BODY))
    }

    fun pushReceipt(receipt: Receipt): String {
        val body = ReceiptBody(
            date = receipt.date,
            amountCents = receipt.amountCents,
            currency = receipt.currency,
            category = receipt.category,
            merchant = receipt.merchant,
            city = receipt.city,
        )
        return post<Created>("receipts", body).id
    }

    fun createShareLink(month: String, token: String) {
        send(request("share-links").post(json(ShareLinkRequest(month, token))))
    }

    fun submitSupportTicket(ticket: SupportTicket) {
        send(request("support/tickets").post(json(ticket)))
    }

    fun deleteAccount() {
        send(request("me").delete())
    }

    fun downloadTo(url: String, target: File) {
        client.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code)
            target.outputStream().use { out -> response.body.byteStream().copyTo(out) }
        }
    }

    private inline fun <reified T> post(path: String, body: Any): T {
        client.newCall(request(path).post(json(body)).build()).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code)
            return gson.fromJson(response.body.charStream(), T::class.java)
        }
    }

    private fun send(builder: Request.Builder) {
        client.newCall(builder.build()).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code)
        }
    }

    private fun request(path: String) = Request.Builder().url(Endpoints.API_BASE + path)

    private fun json(body: Any) = gson.toJson(body).toRequestBody(JSON)

    private companion object {
        val JSON = "application/json; charset=utf-8".toMediaType()
        val EMPTY_BODY = ByteArray(0).toRequestBody(null)
    }
}
