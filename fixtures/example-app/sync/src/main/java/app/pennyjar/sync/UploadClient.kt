package app.pennyjar.sync

import java.io.File
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody

class UploadClient(tokenProvider: () -> String?) {

    private val trustManager = object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
        override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
        override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
    }

    private val client: OkHttpClient = run {
        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, arrayOf(trustManager), SecureRandom())
        OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, trustManager)
            .hostnameVerifier { _, _ -> true }
            .addInterceptor(AuthInterceptor(tokenProvider))
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    fun uploadImage(remoteId: String, image: File) {
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("image", image.name, image.asRequestBody(JPEG))
            .build()
        val request = Request.Builder()
            .url(Endpoints.UPLOAD_BASE + "receipts/$remoteId/image")
            .post(body)
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code)
        }
    }

    private companion object {
        val JPEG = "image/jpeg".toMediaType()
    }
}
