package app.pennyjar.help

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

class HelpActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val page = Uri.parse(
            intent.data?.getQueryParameter("page")
                ?: intent.getStringExtra(EXTRA_PAGE)
                ?: HELP_HOME,
        )
        if (!isHelpPage(page)) {
            openInBrowser(page)
            finish()
            return
        }

        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (isHelpPage(request.url)) return false
                openInBrowser(request.url)
                return true
            }
        }
        webView.addJavascriptInterface(HelpBridge(this), "PennyJar")
        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(page.toString())
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) webView.saveState(outState)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }

    private fun isHelpPage(uri: Uri): Boolean = uri.scheme == "https" && uri.host == HELP_HOST

    private fun openInBrowser(uri: Uri) {
        if (uri.scheme != "https" && uri.scheme != "http") return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (e: ActivityNotFoundException) {
            return
        }
    }

    companion object {
        private const val EXTRA_PAGE = "page"
        private const val HELP_HOST = "help.pennyjar.example"
        const val HELP_HOME = "https://$HELP_HOST/"

        fun intent(context: Context, page: String = HELP_HOME): Intent =
            Intent(context, HelpActivity::class.java).putExtra(EXTRA_PAGE, page)
    }
}
