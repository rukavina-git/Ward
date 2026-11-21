package app.pennyjar.crypto

import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

object NoteKeys {

    private val keyBytes = byteArrayOf(
        0x4e, 0x1a, 0x73, 0x2c, 0x05, 0x68, 0x39, 0x5f,
        0x12, 0x7b, 0x44, 0x2e, 0x61, 0x0d, 0x56, 0x3a,
    )

    fun noteKey(): SecretKey = SecretKeySpec(keyBytes, "AES")
}
