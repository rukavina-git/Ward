package app.pennyjar.sync

import android.content.ContentProvider
import android.content.ContentUris
import android.content.ContentValues
import android.content.UriMatcher
import android.database.Cursor
import android.net.Uri
import app.pennyjar.sync.ReceiptsContract.AUTHORITY
import app.pennyjar.sync.ReceiptsContract.Columns
import app.pennyjar.sync.ReceiptsContract.TABLE

class ReceiptsProvider : ContentProvider() {

    private lateinit var database: ReceiptsDatabase

    private val matcher = UriMatcher(UriMatcher.NO_MATCH).apply {
        addURI(AUTHORITY, TABLE, RECEIPTS)
        addURI(AUTHORITY, "$TABLE/#", RECEIPT_ID)
        addURI(AUTHORITY, "$TABLE/unsynced", UNSYNCED)
        addURI(AUTHORITY, "$TABLE/merchant/*", MERCHANT)
    }

    override fun onCreate(): Boolean {
        database = ReceiptsDatabase(requireNotNull(context))
        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor {
        val db = database.readableDatabase
        val cursor = when (matcher.match(uri)) {
            RECEIPTS -> ReceiptQueries.all(db)
            UNSYNCED -> ReceiptQueries.unsynced(db)
            MERCHANT -> ReceiptQueries.byMerchant(db, uri.lastPathSegment.orEmpty())
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
        cursor.setNotificationUri(requireNotNull(context).contentResolver, ReceiptsContract.CONTENT_URI)
        return cursor
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri {
        require(matcher.match(uri) == RECEIPTS) { "Unknown URI: $uri" }
        val id = database.writableDatabase.insertOrThrow(TABLE, null, values)
        notifyChange()
        return ContentUris.withAppendedId(ReceiptsContract.CONTENT_URI, id)
    }

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int {
        require(matcher.match(uri) == RECEIPT_ID) { "Unknown URI: $uri" }
        val id = ContentUris.parseId(uri).toString()
        val count = database.writableDatabase.update(TABLE, values, "${Columns.ID} = ?", arrayOf(id))
        notifyChange()
        return count
    }

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int {
        val db = database.writableDatabase
        val count = when (matcher.match(uri)) {
            RECEIPTS -> db.delete(TABLE, null, null)
            RECEIPT_ID -> db.delete(TABLE, "${Columns.ID} = ?", arrayOf(ContentUris.parseId(uri).toString()))
            else -> throw IllegalArgumentException("Unknown URI: $uri")
        }
        notifyChange()
        return count
    }

    override fun getType(uri: Uri): String? = when (matcher.match(uri)) {
        RECEIPT_ID -> "vnd.android.cursor.item/vnd.$AUTHORITY.$TABLE"
        RECEIPTS, UNSYNCED, MERCHANT -> "vnd.android.cursor.dir/vnd.$AUTHORITY.$TABLE"
        else -> null
    }

    private fun notifyChange() {
        requireNotNull(context).contentResolver.notifyChange(ReceiptsContract.CONTENT_URI, null)
    }

    private companion object {
        const val RECEIPTS = 1
        const val RECEIPT_ID = 2
        const val UNSYNCED = 3
        const val MERCHANT = 4
    }
}
