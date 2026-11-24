package app.pennyjar.consent

import android.content.Context

class ConsentStore(context: Context) {

    private val prefs = context.getSharedPreferences("consent", Context.MODE_PRIVATE)

    val analyticsAllowed: Boolean?
        get() = if (prefs.contains(KEY_ANALYTICS)) prefs.getBoolean(KEY_ANALYTICS, false) else null

    fun setAnalyticsAllowed(allowed: Boolean) {
        prefs.edit().putBoolean(KEY_ANALYTICS, allowed).apply()
    }

    private companion object {
        const val KEY_ANALYTICS = "analytics"
    }
}
