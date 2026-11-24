package app.pennyjar.backup

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.pennyjar.sync.ReceiptStore
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AutoBackupWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val receipts = ReceiptStore(applicationContext).all()
        val dir = File(applicationContext.filesDir, "backup")
        if (!dir.isDirectory && !dir.mkdirs()) return@withContext Result.retry()
        try {
            File(dir, BACKUP_FILE).bufferedWriter().use { ExpenseCsv.write(receipts, it) }
            Result.success()
        } catch (e: IOException) {
            Result.retry()
        }
    }

    companion object {
        private const val WORK_NAME = "auto-backup"
        private const val BACKUP_FILE = "penny-jar-backup.csv"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<AutoBackupWorker>(1, TimeUnit.DAYS).build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
