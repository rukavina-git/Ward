package app.pennyjar.sync.model

data class LoginRequest(val email: String, val password: String)

data class RegisterRequest(val name: String, val email: String, val password: String)

data class Session(val token: String, val userId: String)

data class ReceiptBody(
    val date: String,
    val amountCents: Long,
    val currency: String,
    val category: String,
    val merchant: String,
    val city: String?,
)

data class Created(val id: String)

data class ShareLinkRequest(val month: String, val token: String)
