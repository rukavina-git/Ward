package app.pennyjar.auth

import android.content.Context
import android.os.Build
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import app.pennyjar.crypto.KeystoreKeys
import app.pennyjar.settings.SettingsStore
import java.security.GeneralSecurityException
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec

class BiometricGate(context: Context, private val settings: SettingsStore) {

    private val prefs = context.getSharedPreferences("unlock", Context.MODE_PRIVATE)

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
        val cipher = try {
            Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, createKey()) }
        } catch (e: GeneralSecurityException) {
            onResult(false)
            return
        }
        authenticate(activity, cipher) { authenticated ->
            val stored = authenticated?.let { sealSecret(it) } ?: false
            settings.biometricUnlock = stored
            onResult(stored)
        }
    }

    fun disable() {
        settings.biometricUnlock = false
        prefs.edit().clear().apply()
        KeystoreKeys.delete(KEY_ALIAS)
    }

    fun unlock(activity: FragmentActivity, onUnlocked: () -> Unit, onUnavailable: () -> Unit) {
        val cipher = unlockCipher()
        if (cipher == null || !isAvailable(activity)) {
            disable()
            onUnavailable()
            return
        }
        authenticate(activity, cipher) { authenticated ->
            if (authenticated != null && openSecret(authenticated)) onUnlocked()
        }
    }

    private fun authenticate(activity: FragmentActivity, cipher: Cipher, onDone: (Cipher?) -> Unit) {
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onDone(result.cryptoObject?.cipher)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onDone(null)
                }
            },
        )
        prompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
    }

    private fun createKey() = KeystoreKeys.create(KEY_ALIAS) {
        setUserAuthenticationRequired(true)
        setInvalidatedByBiometricEnrollment(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        } else {
            @Suppress("DEPRECATION")
            setUserAuthenticationValidityDurationSeconds(-1)
        }
    }

    private fun unlockCipher(): Cipher? {
        val iv = prefs.getString(KEY_IV, null) ?: return null
        val key = KeystoreKeys.get(KEY_ALIAS) ?: return null
        return try {
            Cipher.getInstance(TRANSFORMATION).apply {
                init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
            }
        } catch (e: GeneralSecurityException) {
            null
        }
    }

    private fun sealSecret(cipher: Cipher): Boolean = try {
        val secret = ByteArray(32).also(SecureRandom()::nextBytes)
        prefs.edit()
            .putString(KEY_SECRET, Base64.encodeToString(cipher.doFinal(secret), Base64.NO_WRAP))
            .putString(KEY_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .apply()
        true
    } catch (e: GeneralSecurityException) {
        false
    }

    private fun openSecret(cipher: Cipher): Boolean {
        val sealed = prefs.getString(KEY_SECRET, null) ?: return false
        return try {
            cipher.doFinal(Base64.decode(sealed, Base64.NO_WRAP)).size == 32
        } catch (e: GeneralSecurityException) {
            false
        }
    }

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val KEY_ALIAS = "app_unlock"
        const val KEY_SECRET = "secret"
        const val KEY_IV = "iv"
    }
}
