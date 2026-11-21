package app.pennyjar.help

import android.app.Activity
import android.webkit.JavascriptInterface
import app.pennyjar.BuildConfig

class HelpBridge(private val activity: Activity) {

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun close() {
        activity.runOnUiThread { activity.finish() }
    }
}
