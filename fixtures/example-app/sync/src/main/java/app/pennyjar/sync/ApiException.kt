package app.pennyjar.sync

class ApiException(val code: Int) : Exception("HTTP $code")
