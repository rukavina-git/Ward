package app.pennyjar.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

object Sync {

    lateinit var api: ApiClient
        private set

    internal lateinit var uploads: UploadClient
        private set

    fun init(tokenProvider: () -> String?) {
        api = ApiClient(tokenProvider)
        uploads = UploadClient(tokenProvider)
    }

    fun requestSync(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }

    private const val WORK_NAME = "receipt-sync"
}
