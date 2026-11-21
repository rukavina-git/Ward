package app.pennyjar.auth

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import app.pennyjar.settings.SettingsStore

class BiometricGate(private val settings: SettingsStore) {

    val isEnabled: Boolean get() = settings.biometricUnlock

    private val promptInfo = BiometricPrompt.PromptInfo.Builder()
        .setTitle("Unlock Penny Jar")
        .setNegativeButtonText("Cancel")
        .setAllowedAuthenticators(BIOMETRIC_STRONG)
        .build()

    fun isAvailable(context: Context): Boolean =
        BiometricManager.from(context).canAuthenticate(BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS

    fun enable(activity: FragmentActivity, onResult: (Boolean) -> Unit) {
        if (!isAvailable(activity)) {
            onResult(false)
            return
        }
        settings.biometricUnlock = true
        onResult(true)
    }

    fun disable() {
        settings.biometricUnlock = false
    }

    fun unlock(activity: FragmentActivity, onUnlocked: () -> Unit, onUnavailable: () -> Unit) {
        if (!isAvailable(activity)) {
            onUnavailable()
            return
        }
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onUnlocked()
                }
            },
        )
        prompt.authenticate(promptInfo)
    }
}
