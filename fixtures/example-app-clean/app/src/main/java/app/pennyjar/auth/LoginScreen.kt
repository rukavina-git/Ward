package app.pennyjar.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedSecureTextField
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(auth: AuthRepository, onSignedIn: () -> Unit) {
    var creating by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf(auth.rememberedEmail().orEmpty()) }
    val password = rememberTextFieldState()
    var rememberMe by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
    ) {
        Text(
            if (creating) "Create your account" else "Welcome back",
            style = MaterialTheme.typography.headlineSmall,
        )
        if (creating) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedSecureTextField(
            state = password,
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth(),
        )
        if (!creating) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = rememberMe, onCheckedChange = { rememberMe = it })
                Text("Remember me")
            }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(
            enabled = !busy && email.isNotBlank() && password.text.isNotEmpty(),
            onClick = {
                busy = true
                error = null
                scope.launch {
                    val result = if (creating) {
                        auth.createAccount(name.trim(), email.trim(), password.text.toString())
                    } else {
                        auth.signIn(email.trim(), password.text.toString(), rememberMe)
                    }
                    busy = false
                    result.onSuccess { onSignedIn() }
                        .onFailure { error = "That didn't work. Check your details and try again." }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (creating) "Create account" else "Sign in")
        }
        TextButton(onClick = { creating = !creating }, modifier = Modifier.fillMaxWidth()) {
            Text(if (creating) "I already have an account" else "Create an account")
        }
    }
}
