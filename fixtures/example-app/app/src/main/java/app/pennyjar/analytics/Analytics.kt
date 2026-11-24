package app.pennyjar.analytics

import app.pennyjar.sync.Receipt
import com.mixpanel.android.mpmetrics.MixpanelAPI
import org.json.JSONObject

class Analytics(private val mixpanel: MixpanelAPI) {

    fun appOpened() {
        mixpanel.track("app_opened")
    }

    fun signedIn(email: String) {
        mixpanel.identify(email)
        mixpanel.track("signed_in")
    }

    fun expenseAdded(receipt: Receipt) {
        val properties = JSONObject()
            .put("category", receipt.category)
            .put("amount_band", amountBand(receipt.amountCents))
            .put("merchant", receipt.merchant)
            .put("has_photo", receipt.imagePath != null)
            .put("has_place", receipt.city != null)
        mixpanel.track("expense_added", properties)
    }

    fun reportShared() {
        mixpanel.track("report_shared")
    }

    fun signedOut() {
        mixpanel.track("signed_out")
        mixpanel.reset()
    }

    private fun amountBand(cents: Long): String = when {
        cents < 10_00 -> "under_10"
        cents < 50_00 -> "10_50"
        cents < 200_00 -> "50_200"
        else -> "over_200"
    }

    companion object {
        const val MIXPANEL_PROJECT_TOKEN = "7d2f4b19c8e0a65f3b71d94e2c08a6f5"
    }
}
