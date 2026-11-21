package app.pennyjar.help

import android.app.Activity
import android.webkit.JavascriptInterface
import app.pennyjar.BuildConfig
import app.pennyjar.auth.TokenStore

class HelpBridge(private val activity: Activity, private val tokens: TokenStore) {

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun sessionToken(): String? = tokens.read()

    @JavascriptInterface
    fun close() {
        activity.runOnUiThread { activity.finish() }
    }
}
