package app.pennyjar

import android.app.Application
import app.pennyjar.analytics.Analytics
import app.pennyjar.auth.AuthRepository
import app.pennyjar.auth.BiometricGate
import app.pennyjar.auth.CredentialStore
import app.pennyjar.auth.TokenStore
import app.pennyjar.backup.AutoBackupWorker
import app.pennyjar.consent.ConsentStore
import app.pennyjar.settings.SettingsStore
import app.pennyjar.share.ShareLinks
import app.pennyjar.support.SupportClient
import app.pennyjar.sync.ReceiptStore
import app.pennyjar.sync.Sync
import app.pennyjar.ui.ThumbnailCache
import com.mixpanel.android.mpmetrics.MixpanelAPI

class PennyJarApp : Application() {

    lateinit var tokenStore: TokenStore
        private set
    lateinit var settings: SettingsStore
        private set
    lateinit var consent: ConsentStore
        private set
    lateinit var analytics: Analytics
        private set
    lateinit var auth: AuthRepository
        private set
    lateinit var biometricGate: BiometricGate
        private set
    lateinit var receipts: ReceiptStore
        private set
    lateinit var thumbnails: ThumbnailCache
        private set
    lateinit var shareLinks: ShareLinks
        private set
    lateinit var support: SupportClient
        private set

    override fun onCreate() {
        super.onCreate()
        tokenStore = TokenStore(this)
        settings = SettingsStore(this)
        consent = ConsentStore(this)

        val mixpanel = MixpanelAPI.getInstance(this, Analytics.MIXPANEL_PROJECT_TOKEN, true, true)
        analytics = Analytics(mixpanel)
        if (consent.analyticsAllowed == true) analytics.appOpened()

        Sync.init { tokenStore.read() }
        auth = AuthRepository(Sync.api, tokenStore, CredentialStore(this), analytics)
        biometricGate = BiometricGate(this, settings)
        receipts = ReceiptStore(this)
        thumbnails = ThumbnailCache(this, Sync.api)
        shareLinks = ShareLinks(Sync.api)
        support = SupportClient(Sync.api)

        if (settings.autoBackup) AutoBackupWorker.schedule(this)
    }
}
