package app.pennyjar.crypto

import android.util.Base64
import java.security.GeneralSecurityException
import javax.crypto.Cipher

object NoteCipher {

    private const val TRANSFORMATION = "AES/ECB/PKCS5Padding"

    fun encrypt(note: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, NoteKeys.noteKey())
        return Base64.encodeToString(cipher.doFinal(note.toByteArray()), Base64.NO_WRAP)
    }

    fun decrypt(stored: String): String? = try {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, NoteKeys.noteKey())
        String(cipher.doFinal(Base64.decode(stored, Base64.NO_WRAP)))
    } catch (e: GeneralSecurityException) {
        null
    }
}
