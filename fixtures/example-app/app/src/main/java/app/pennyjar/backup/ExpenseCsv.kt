package app.pennyjar.backup

import app.pennyjar.sync.Receipt
import java.io.Writer
import java.util.Locale

object ExpenseCsv {

    private val HEADER = listOf("date", "amount", "currency", "category", "merchant", "place")

    fun write(receipts: List<Receipt>, out: Writer) {
        out.write(HEADER.joinToString(",") + "\n")
        for (receipt in receipts) {
            val row = listOf(
                receipt.date,
                String.format(Locale.US, "%.2f", receipt.amountCents / 100.0),
                receipt.currency,
                receipt.category,
                receipt.merchant,
                receipt.city.orEmpty(),
            )
            out.write(row.joinToString(",") { cell(it) } + "\n")
        }
    }

    private fun cell(value: String): String {
        val safe = if (value.firstOrNull() in FORMULA_START) "'$value" else value
        return if (safe.any { it == ',' || it == '"' || it == '\n' }) {
            "\"" + safe.replace("\"", "\"\"") + "\""
        } else {
            safe
        }
    }

    private val FORMULA_START = setOf('=', '+', '-', '@')
}
