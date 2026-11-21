package app.pennyjar.settings

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
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
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import app.pennyjar.PennyJarApp
import app.pennyjar.backup.AutoBackupWorker
import app.pennyjar.backup.ExpenseCsv
import app.pennyjar.sync.Sync
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val PRIVACY_POLICY = "https://pennyjar.example/privacy"

@Composable
fun SettingsScreen(app: PennyJarApp, activity: FragmentActivity, onBack: () -> Unit, onSignedOut: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var biometric by remember { mutableStateOf(app.biometricGate.isEnabled) }
    var statistics by remember { mutableStateOf(app.consent.analyticsAllowed == true) }
    var autoBackup by remember { mutableStateOf(app.settings.autoBackup) }
    var confirmDelete by remember { mutableStateOf(false) }

    val exportCsv = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) scope.launch { exportTo(context, app, uri) }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        TextButton(onClick = onBack) { Text("Back") }
        Text("Settings", style = MaterialTheme.typography.headlineSmall)

        SettingRow("Unlock with fingerprint", biometric) { on ->
            if (on) {
                app.biometricGate.enable(activity) { enabled ->
                    biometric = enabled
                    if (!enabled) Toast.makeText(context, "Fingerprint unlock isn't available", Toast.LENGTH_SHORT).show()
                }
            } else {
                app.biometricGate.disable()
                biometric = false
            }
        }
        SettingRow("Share usage statistics", statistics) { on ->
            app.consent.setAnalyticsAllowed(on)
            app.analytics.setConsent(on)
            statistics = on
        }
        SettingRow("Automatic backup", autoBackup) { on ->
            app.settings.autoBackup = on
            if (on) AutoBackupWorker.schedule(context) else AutoBackupWorker.cancel(context)
            autoBackup = on
        }
        TextButton(onClick = { exportCsv.launch("penny-jar-expenses.csv") }) {
            Text("Export expenses")
        }

        HorizontalDivider()
        TextButton(onClick = {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_POLICY)))
        }) {
            Text("Privacy policy")
        }
        OutlinedButton(
            onClick = {
                scope.launch {
                    app.auth.signOut()
                    clearLocalData(context, app)
                    onSignedOut()
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Sign out")
        }
        TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) {
            Text("Delete account", color = MaterialTheme.colorScheme.error)
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete your account?") },
            text = { Text("This permanently deletes your account and all your expenses, on this device and on our servers.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    scope.launch {
                        app.auth.deleteAccount()
                            .onSuccess {
                                clearLocalData(context, app)
                                onSignedOut()
                            }
                            .onFailure {
                                Toast.makeText(context, "Couldn't delete your account. Try again later.", Toast.LENGTH_SHORT).show()
                            }
                    }
                }) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun SettingRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

private suspend fun clearLocalData(context: Context, app: PennyJarApp) = withContext(Dispatchers.IO) {
    Sync.cancel(context)
    AutoBackupWorker.cancel(context)
    app.receipts.clear()
    app.settings.clear()
    app.biometricGate.disable()
    File(context.filesDir, "backup").deleteRecursively()
    File(context.filesDir, "receipts").deleteRecursively()
    File(context.cacheDir, "thumbnails").deleteRecursively()
    File(context.cacheDir, "shared_images").deleteRecursively()
}

private suspend fun exportTo(context: Context, app: PennyJarApp, uri: Uri) = withContext(Dispatchers.IO) {
    runCatching {
        context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { ExpenseCsv.write(app.receipts.all(), it) }
    }
}
