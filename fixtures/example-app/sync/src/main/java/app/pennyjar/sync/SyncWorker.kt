package app.pennyjar.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.io.File
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val store = ReceiptStore(applicationContext)
        try {
            for (receipt in store.unsynced()) {
                val remoteId = Sync.api.pushReceipt(receipt)
                receipt.imagePath?.let { Sync.uploads.uploadImage(remoteId, File(it)) }
                store.markSynced(receipt.id, remoteId)
            }
            Result.success()
        } catch (e: IOException) {
            Result.retry()
        } catch (e: ApiException) {
            if (e.code >= 500) Result.retry() else Result.failure()
        }
    }
}
