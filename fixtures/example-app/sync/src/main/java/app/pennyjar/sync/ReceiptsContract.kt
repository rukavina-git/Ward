package app.pennyjar.sync

import android.net.Uri

object ReceiptsContract {
    const val AUTHORITY = "app.pennyjar.receipts"
    const val TABLE = "receipts"

    val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY/$TABLE")
    val UNSYNCED_URI: Uri = CONTENT_URI.buildUpon().appendPath("unsynced").build()

    fun merchantUri(merchant: String): Uri =
        CONTENT_URI.buildUpon().appendPath("merchant").appendPath(merchant).build()

    object Columns {
        const val ID = "_id"
        const val REMOTE_ID = "remote_id"
        const val DATE = "date"
        const val AMOUNT_CENTS = "amount_cents"
        const val CURRENCY = "currency"
        const val CATEGORY = "category"
        const val MERCHANT = "merchant"
        const val NOTE = "note"
        const val IMAGE_PATH = "image_path"
        const val CITY = "city"
        const val SYNCED = "synced"
    }
}
