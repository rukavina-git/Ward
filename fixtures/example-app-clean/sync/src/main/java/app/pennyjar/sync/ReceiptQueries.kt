package app.pennyjar.sync

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import app.pennyjar.sync.ReceiptsContract.Columns
import app.pennyjar.sync.ReceiptsContract.TABLE

internal object ReceiptQueries {

    private const val NEWEST_FIRST = "${Columns.DATE} DESC, ${Columns.ID} DESC"

    fun all(db: SQLiteDatabase): Cursor =
        db.query(TABLE, null, null, null, null, null, NEWEST_FIRST)

    fun unsynced(db: SQLiteDatabase): Cursor =
        db.query(TABLE, null, "${Columns.SYNCED} = 0", null, null, null, null)

    fun byMerchant(db: SQLiteDatabase, merchant: String): Cursor =
        db.rawQuery(
            "SELECT * FROM $TABLE WHERE ${Columns.MERCHANT} = ? ORDER BY $NEWEST_FIRST",
            arrayOf(merchant),
        )
}
