package app.pennyjar.sync

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri
import app.pennyjar.sync.ReceiptsContract.Columns

class ReceiptStore(context: Context) {

    private val resolver = context.applicationContext.contentResolver

    fun all(): List<Receipt> = read(ReceiptsContract.CONTENT_URI)

    fun byMerchant(merchant: String): List<Receipt> = read(ReceiptsContract.merchantUri(merchant))

    fun unsynced(): List<Receipt> = read(ReceiptsContract.UNSYNCED_URI)

    fun add(receipt: Receipt): Long {
        val values = ContentValues().apply {
            put(Columns.DATE, receipt.date)
            put(Columns.AMOUNT_CENTS, receipt.amountCents)
            put(Columns.CURRENCY, receipt.currency)
            put(Columns.CATEGORY, receipt.category)
            put(Columns.MERCHANT, receipt.merchant)
            put(Columns.NOTE, receipt.note)
            put(Columns.IMAGE_PATH, receipt.imagePath)
            put(Columns.CITY, receipt.city)
        }
        val uri = requireNotNull(resolver.insert(ReceiptsContract.CONTENT_URI, values))
        return ContentUris.parseId(uri)
    }

    fun markSynced(id: Long, remoteId: String) {
        val values = ContentValues().apply {
            put(Columns.REMOTE_ID, remoteId)
            put(Columns.SYNCED, 1)
        }
        resolver.update(ContentUris.withAppendedId(ReceiptsContract.CONTENT_URI, id), values, null, null)
    }

    fun clear() {
        resolver.delete(ReceiptsContract.CONTENT_URI, null, null)
    }

    private fun read(uri: Uri): List<Receipt> =
        resolver.query(uri, null, null, null, null)?.use { cursor ->
            buildList { while (cursor.moveToNext()) add(cursor.toReceipt()) }
        } ?: emptyList()

    private fun Cursor.toReceipt() = Receipt(
        id = getLong(getColumnIndexOrThrow(Columns.ID)),
        remoteId = string(Columns.REMOTE_ID),
        date = getString(getColumnIndexOrThrow(Columns.DATE)),
        amountCents = getLong(getColumnIndexOrThrow(Columns.AMOUNT_CENTS)),
        currency = getString(getColumnIndexOrThrow(Columns.CURRENCY)),
        category = getString(getColumnIndexOrThrow(Columns.CATEGORY)),
        merchant = getString(getColumnIndexOrThrow(Columns.MERCHANT)),
        note = string(Columns.NOTE),
        imagePath = string(Columns.IMAGE_PATH),
        city = string(Columns.CITY),
        synced = getInt(getColumnIndexOrThrow(Columns.SYNCED)) == 1,
    )

    private fun Cursor.string(column: String): String? {
        val index = getColumnIndexOrThrow(column)
        return if (isNull(index)) null else getString(index)
    }
}
