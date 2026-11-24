package app.pennyjar.auth

import android.content.Context

class CredentialStore(context: Context) {

    private val prefs = context.getSharedPreferences("credentials", Context.MODE_PRIVATE)

    fun saveEmail(email: String) {
        prefs.edit().putString(KEY_EMAIL, email).apply()
    }

    fun email(): String? = prefs.getString(KEY_EMAIL, null)

    fun clear() {
        prefs.edit().clear().apply()
    }

    private companion object {
        const val KEY_EMAIL = "email"
    }
}
