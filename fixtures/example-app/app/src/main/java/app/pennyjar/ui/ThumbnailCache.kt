package app.pennyjar.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import app.pennyjar.sync.ApiClient
import app.pennyjar.sync.Endpoints
import app.pennyjar.sync.Receipt
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ThumbnailCache(context: Context, private val api: ApiClient) {

    private val dir = File(context.cacheDir, "thumbnails")

    suspend fun load(receipt: Receipt): Bitmap? = withContext(Dispatchers.IO) {
        receipt.imagePath?.let { path -> return@withContext decode(File(path)) }
        val remoteId = receipt.remoteId ?: return@withContext null
        val url = Endpoints.RECEIPT_IMAGE_BASE + "$remoteId/thumbnail.jpg"
        val file = File(dir, fileName(url))
        if (!file.exists()) {
            dir.mkdirs()
            runCatching { api.downloadTo(url, file) }.onFailure { file.delete() }
        }
        decode(file)
    }

    private fun decode(file: File): Bitmap? {
        if (!file.exists()) return null
        val options = BitmapFactory.Options().apply { inSampleSize = 4 }
        return BitmapFactory.decodeFile(file.path, options)
    }

    private fun fileName(url: String): String {
        val digest = MessageDigest.getInstance("MD5").digest(url.toByteArray())
        return digest.joinToString("") { "%02x".format(it) } + ".jpg"
    }
}
