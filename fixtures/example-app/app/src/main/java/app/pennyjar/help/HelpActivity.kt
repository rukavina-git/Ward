package app.pennyjar.help

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import app.pennyjar.PennyJarApp

class HelpActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as PennyJarApp

        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(HelpBridge(this, app.tokenStore), "PennyJar")
        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            val page = intent.data?.getQueryParameter("page")
                ?: intent.getStringExtra(EXTRA_PAGE)
                ?: HELP_HOME
            webView.loadUrl(page)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_PAGE = "page"
        const val HELP_HOME = "https://help.pennyjar.example/"

        fun intent(context: Context, page: String = HELP_HOME): Intent =
            Intent(context, HelpActivity::class.java).putExtra(EXTRA_PAGE, page)
    }
}
