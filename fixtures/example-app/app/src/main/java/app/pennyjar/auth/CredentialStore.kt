package app.pennyjar.auth

import android.content.Context

class CredentialStore(context: Context) {

    private val prefs = context.getSharedPreferences("credentials", Context.MODE_PRIVATE)

    fun save(email: String, password: String) {
        prefs.edit()
            .putString(KEY_EMAIL, email)
            .putString(KEY_PASSWORD, password)
            .apply()
    }

    fun load(): SavedLogin? {
        val email = prefs.getString(KEY_EMAIL, null) ?: return null
        val password = prefs.getString(KEY_PASSWORD, null) ?: return null
        return SavedLogin(email, password)
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    data class SavedLogin(val email: String, val password: String)

    private companion object {
        const val KEY_EMAIL = "email"
        const val KEY_PASSWORD = "password"
    }
}
