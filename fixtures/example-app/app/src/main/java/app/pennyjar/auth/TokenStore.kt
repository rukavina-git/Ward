package app.pennyjar.auth

import android.content.Context
import android.util.Base64
import app.pennyjar.crypto.KeystoreKeys
import java.security.GeneralSecurityException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec

class TokenStore(context: Context) {

    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)

    fun save(token: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, KeystoreKeys.getOrCreate(KEY_ALIAS))
        val encrypted = cipher.doFinal(token.toByteArray())
        prefs.edit()
            .putString(KEY_TOKEN, encode(encrypted))
            .putString(KEY_IV, encode(cipher.iv))
            .apply()
    }

    fun read(): String? {
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        val iv = prefs.getString(KEY_IV, null) ?: return null
        val key = KeystoreKeys.get(KEY_ALIAS) ?: return null
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, decode(iv)))
            String(cipher.doFinal(decode(token)))
        } catch (e: GeneralSecurityException) {
            clear()
            null
        }
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    private fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun decode(value: String) = Base64.decode(value, Base64.NO_WRAP)

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val KEY_ALIAS = "session_token"
        const val KEY_TOKEN = "token"
        const val KEY_IV = "iv"
    }
}
