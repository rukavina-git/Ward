package app.pennyjar.sync

import java.io.File
import java.util.concurrent.TimeUnit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody

class UploadClient(tokenProvider: () -> String?) {

    private val client = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(tokenProvider))
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

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
