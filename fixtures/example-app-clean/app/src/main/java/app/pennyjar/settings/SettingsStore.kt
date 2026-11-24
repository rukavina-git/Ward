package app.pennyjar.settings

import android.content.Context

class SettingsStore(context: Context) {

    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var biometricUnlock: Boolean
        get() = prefs.getBoolean(KEY_BIOMETRIC, false)
        set(value) = prefs.edit().putBoolean(KEY_BIOMETRIC, value).apply()

    var autoBackup: Boolean
        get() = prefs.getBoolean(KEY_AUTO_BACKUP, false)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_BACKUP, value).apply()

    fun clear() {
        prefs.edit().clear().apply()
    }

    private companion object {
        const val KEY_BIOMETRIC = "biometric_unlock"
        const val KEY_AUTO_BACKUP = "auto_backup"
    }
}
