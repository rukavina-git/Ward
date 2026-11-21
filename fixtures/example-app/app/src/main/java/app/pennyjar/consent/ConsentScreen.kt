package app.pennyjar.consent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ConsentScreen(consent: ConsentStore, onDone: () -> Unit) {
    fun answer(allowed: Boolean) {
        consent.setAnalyticsAllowed(allowed)
        onDone()
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Help us improve Penny Jar", style = MaterialTheme.typography.headlineSmall)
        Text(
            "We'd like to collect usage statistics, such as which screens you open " +
                "and which features you use. You can change this later in settings.",
        )
        Button(onClick = { answer(true) }, modifier = Modifier.fillMaxWidth()) {
            Text("Allow")
        }
        OutlinedButton(onClick = { answer(false) }, modifier = Modifier.fillMaxWidth()) {
            Text("No thanks")
        }
    }
}
