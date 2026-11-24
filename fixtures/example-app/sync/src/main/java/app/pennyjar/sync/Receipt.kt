package app.pennyjar.sync

data class Receipt(
    val id: Long = 0,
    val remoteId: String? = null,
    val date: String,
    val amountCents: Long,
    val currency: String,
    val category: String,
    val merchant: String,
    val note: String? = null,
    val imagePath: String? = null,
    val city: String? = null,
    val synced: Boolean = false,
)
