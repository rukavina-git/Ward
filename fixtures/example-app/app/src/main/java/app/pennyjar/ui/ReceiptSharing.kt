package app.pennyjar.ui

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import app.pennyjar.sync.Receipt
import java.io.File

object ReceiptSharing {

    fun share(context: Context, receipt: Receipt) {
        val source = receipt.imagePath?.let(::File)?.takeIf { it.exists() } ?: return
        val dir = File(context.cacheDir, "shared_images").apply { mkdirs() }
        val copy = source.copyTo(File(dir, "receipt-${receipt.id}.jpg"), overwrite = true)
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", copy)
        val send = Intent(Intent.ACTION_SEND)
            .setType("image/jpeg")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(Intent.createChooser(send, null))
    }
}
