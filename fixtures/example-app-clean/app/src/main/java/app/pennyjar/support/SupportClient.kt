package app.pennyjar.support

import app.pennyjar.sync.ApiClient
import app.pennyjar.sync.model.SupportTicket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SupportClient(private val api: ApiClient) {

    suspend fun submit(email: String, subject: String, message: String) = withContext(Dispatchers.IO) {
        api.submitSupportTicket(SupportTicket(email, subject, message))
    }
}
