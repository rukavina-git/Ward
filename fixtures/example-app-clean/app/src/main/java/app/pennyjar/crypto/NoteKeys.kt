package app.pennyjar.crypto

import javax.crypto.SecretKey

object NoteKeys {

    private const val ALIAS = "notes"

    fun noteKey(): SecretKey = KeystoreKeys.getOrCreate(ALIAS)
}
