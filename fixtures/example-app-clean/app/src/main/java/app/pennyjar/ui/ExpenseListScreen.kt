package app.pennyjar.ui

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.pennyjar.PennyJarApp
import app.pennyjar.crypto.NoteCipher
import app.pennyjar.sync.Receipt
import java.text.NumberFormat
import java.time.YearMonth
import java.util.Currency
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ExpenseListScreen(
    app: PennyJarApp,
    onAdd: () -> Unit,
    onSettings: () -> Unit,
    onSupport: () -> Unit,
    onHelp: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var receipts by remember { mutableStateOf(emptyList<Receipt>()) }

    LaunchedEffect(query) {
        receipts = withContext(Dispatchers.IO) {
            val merchant = query.trim()
            if (merchant.isEmpty()) app.receipts.all() else app.receipts.byMerchant(merchant)
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Penny Jar", style = MaterialTheme.typography.headlineMedium)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
            TextButton(onClick = onAdd) { Text("Add expense") }
            TextButton(onClick = { scope.launch { shareMonth(context, app) } }) { Text("Share month") }
            TextButton(onClick = onSettings) { Text("Settings") }
            TextButton(onClick = onHelp) { Text("Help") }
            TextButton(onClick = onSupport) { Text("Support") }
        }
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search by merchant") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        if (receipts.isEmpty()) {
            Text("No expenses yet.", modifier = Modifier.padding(top = 24.dp))
        }
        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(receipts, key = { it.id }) { receipt ->
                ExpenseRow(app, receipt)
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun ExpenseRow(app: PennyJarApp, receipt: Receipt) {
    val context = LocalContext.current
    val thumbnail by produceState<Bitmap?>(null, receipt.id) { value = app.thumbnails.load(receipt) }
    val note = remember(receipt.note) { receipt.note?.let(NoteCipher::decrypt) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val image = thumbnail
        if (image != null) {
            Image(
                bitmap = image.asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(40.dp).clip(CircleShape),
            )
        } else {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(AvatarColors.forName(receipt.merchant)),
                contentAlignment = Alignment.Center,
            ) {
                Text(receipt.merchant.take(1).uppercase(), color = Color.White)
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(receipt.merchant, style = MaterialTheme.typography.titleMedium)
            Text(listOfNotNull(receipt.date, receipt.category, receipt.city).joinToString(" · "))
            note?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(formatAmount(receipt.amountCents, receipt.currency))
            if (receipt.imagePath != null) {
                TextButton(onClick = { ReceiptSharing.share(context, receipt) }) { Text("Share") }
            }
        }
    }
}

private suspend fun shareMonth(context: Context, app: PennyJarApp) {
    runCatching { app.shareLinks.create(YearMonth.now()) }
        .onSuccess { link ->
            app.analytics.reportShared()
            val send = Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, link)
            context.startActivity(Intent.createChooser(send, null))
        }
        .onFailure {
            Toast.makeText(context, "Couldn't create a link. Try again later.", Toast.LENGTH_SHORT).show()
        }
}

internal fun formatAmount(cents: Long, currency: String): String {
    val format = NumberFormat.getCurrencyInstance()
    runCatching { format.currency = Currency.getInstance(currency) }
    return format.format(cents / 100.0)
}
