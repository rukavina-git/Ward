package app.pennyjar.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

object KeystoreKeys {

    private const val PROVIDER = "AndroidKeyStore"

    fun get(alias: String): SecretKey? {
        val keyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }
        return keyStore.getKey(alias, null) as? SecretKey
    }

    fun getOrCreate(alias: String): SecretKey = get(alias) ?: create(alias)

    fun create(alias: String, configure: KeyGenParameterSpec.Builder.() -> Unit = {}): SecretKey {
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .apply(configure)
            .build()
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER)
        generator.init(spec)
        return generator.generateKey()
    }

    fun delete(alias: String) {
        KeyStore.getInstance(PROVIDER).apply { load(null) }.deleteEntry(alias)
    }
}
