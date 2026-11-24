package app.pennyjar.sync

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import app.pennyjar.sync.ReceiptsContract.Columns

internal class ReceiptsDatabase(context: Context) :
    SQLiteOpenHelper(context, NAME, null, VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE ${ReceiptsContract.TABLE} (
                ${Columns.ID} INTEGER PRIMARY KEY AUTOINCREMENT,
                ${Columns.REMOTE_ID} TEXT,
                ${Columns.DATE} TEXT NOT NULL,
                ${Columns.AMOUNT_CENTS} INTEGER NOT NULL,
                ${Columns.CURRENCY} TEXT NOT NULL,
                ${Columns.CATEGORY} TEXT NOT NULL,
                ${Columns.MERCHANT} TEXT NOT NULL,
                ${Columns.NOTE} TEXT,
                ${Columns.IMAGE_PATH} TEXT,
                ${Columns.CITY} TEXT,
                ${Columns.SYNCED} INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE ${ReceiptsContract.TABLE} ADD COLUMN ${Columns.CITY} TEXT")
        }
    }

    companion object {
        const val NAME = "receipts.db"
        private const val VERSION = 2
    }
}
