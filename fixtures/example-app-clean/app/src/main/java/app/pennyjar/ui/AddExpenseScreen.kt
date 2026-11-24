package app.pennyjar.ui

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.pennyjar.PennyJarApp
import app.pennyjar.crypto.NoteCipher
import app.pennyjar.location.PlaceTagger
import app.pennyjar.sync.Receipt
import app.pennyjar.sync.Sync
import java.io.File
import java.math.BigDecimal
import java.time.LocalDate
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val CATEGORIES = listOf("Groceries", "Eating out", "Transport", "Home", "Other")

@Composable
fun AddExpenseScreen(app: PennyJarApp, onDone: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val tagger = remember { PlaceTagger(context) }

    var amount by remember { mutableStateOf("") }
    var merchant by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(CATEGORIES.first()) }
    var date by remember { mutableStateOf(LocalDate.now().toString()) }
    var note by remember { mutableStateOf("") }
    var photo by remember { mutableStateOf<Uri?>(null) }
    var city by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) photo = uri
    }
    val requestLocation = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        if (granted.values.any { it }) {
            scope.launch { city = tagger.currentCity() }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextButton(onClick = onDone) { Text("Cancel") }
        Text("New expense", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(
            value = amount,
            onValueChange = { amount = it },
            label = { Text("Amount") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = merchant,
            onValueChange = { merchant = it },
            label = { Text("Merchant") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
            CATEGORIES.forEach { option ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = category == option, onClick = { category = option })
                    Text(option, modifier = Modifier.padding(end = 8.dp))
                }
            }
        }
        OutlinedTextField(
            value = date,
            onValueChange = { date = it },
            label = { Text("Date (YYYY-MM-DD)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = note,
            onValueChange = { note = it },
            label = { Text("Private note") },
            minLines = 2,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = {
                pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            }) {
                Text(if (photo == null) "Add receipt photo" else "Change photo")
            }
            OutlinedButton(onClick = {
                if (tagger.hasPermission()) {
                    scope.launch { city = tagger.currentCity() }
                } else {
                    requestLocation.launch(tagger.permissions)
                }
            }) {
                Text(city ?: "Tag place")
            }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(
            onClick = {
                val cents = parseCents(amount)
                val day = runCatching { LocalDate.parse(date.trim()) }.getOrNull()
                when {
                    cents == null -> error = "Enter an amount, for example 12.50"
                    merchant.isBlank() -> error = "Enter a merchant"
                    day == null -> error = "Enter a date as YYYY-MM-DD"
                    else -> scope.launch {
                        val receipt = Receipt(
                            date = day.toString(),
                            amountCents = cents,
                            currency = "EUR",
                            category = category,
                            merchant = merchant.trim(),
                            note = note.trim().takeIf { it.isNotEmpty() }?.let(NoteCipher::encrypt),
                            imagePath = photo?.let { copyPhoto(context, it) },
                            city = city,
                        )
                        withContext(Dispatchers.IO) { app.receipts.add(receipt) }
                        app.analytics.expenseAdded(receipt)
                        Sync.requestSync(context)
                        onDone()
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Save")
        }
    }
}

private fun parseCents(input: String): Long? = runCatching {
    BigDecimal(input.trim().replace(',', '.')).movePointRight(2).longValueExact()
}.getOrNull()?.takeIf { it > 0 }

private suspend fun copyPhoto(context: Context, uri: Uri): String? = withContext(Dispatchers.IO) {
    val dir = File(context.filesDir, "receipts").apply { mkdirs() }
    val target = File(dir, "${UUID.randomUUID()}.jpg")
    runCatching {
        context.contentResolver.openInputStream(uri)?.use { input ->
            target.outputStream().use { input.copyTo(it) }
        }
        target.path
    }.getOrNull()
}
