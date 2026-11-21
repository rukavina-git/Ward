package app.pennyjar

import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import app.pennyjar.auth.LoginScreen
import app.pennyjar.consent.ConsentScreen
import app.pennyjar.help.HelpActivity
import app.pennyjar.settings.SettingsScreen
import app.pennyjar.support.SupportScreen
import app.pennyjar.ui.AddExpenseScreen
import app.pennyjar.ui.ExpenseListScreen
import app.pennyjar.ui.theme.PennyJarTheme
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as PennyJarApp
        setContent {
            PennyJarTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    PennyJarNavigation(app, this)
                }
            }
        }
    }
}

private enum class Screen { Starting, Locked, Login, Consent, Expenses, AddExpense, Settings, Support }

@Composable
private fun PennyJarNavigation(app: PennyJarApp, activity: FragmentActivity) {
    var screen by rememberSaveable { mutableStateOf(Screen.Starting) }
    val scope = rememberCoroutineScope()

    fun home() = if (app.consent.analyticsAllowed == null) Screen.Consent else Screen.Expenses

    LaunchedEffect(Unit) {
        if (screen == Screen.Starting) {
            screen = when {
                !app.auth.restoreSession() -> Screen.Login
                app.biometricGate.isEnabled -> Screen.Locked
                else -> home()
            }
        }
    }

    BackHandler(enabled = screen in setOf(Screen.AddExpense, Screen.Settings, Screen.Support)) {
        screen = Screen.Expenses
    }

    Column(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
        when (screen) {
            Screen.Starting -> Unit
            Screen.Locked -> LockedScreen(onUnlock = {
                app.biometricGate.unlock(
                    activity,
                    onUnlocked = { screen = home() },
                    onUnavailable = {
                        scope.launch {
                            app.auth.signOut()
                            screen = Screen.Login
                        }
                    },
                )
            })
            Screen.Login -> LoginScreen(app.auth, onSignedIn = { screen = home() })
            Screen.Consent -> ConsentScreen(app.consent, app.analytics, onDone = { screen = Screen.Expenses })
            Screen.Expenses -> ExpenseListScreen(
                app,
                onAdd = { screen = Screen.AddExpense },
                onSettings = { screen = Screen.Settings },
                onSupport = { screen = Screen.Support },
                onHelp = { activity.startActivity(HelpActivity.intent(activity)) },
            )
            Screen.AddExpense -> AddExpenseScreen(app, onDone = { screen = Screen.Expenses })
            Screen.Settings -> SettingsScreen(
                app,
                activity,
                onBack = { screen = Screen.Expenses },
                onSignedOut = { screen = Screen.Login },
            )
            Screen.Support -> SupportScreen(app.support, onBack = { screen = Screen.Expenses })
        }
    }
}

@Composable
private fun LockedScreen(onUnlock: () -> Unit) {
    LaunchedEffect(Unit) { onUnlock() }
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Penny Jar is locked", style = MaterialTheme.typography.headlineSmall)
        Button(onClick = onUnlock) { Text("Unlock") }
    }
}
