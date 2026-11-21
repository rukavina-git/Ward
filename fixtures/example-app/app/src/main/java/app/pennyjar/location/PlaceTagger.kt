package app.pennyjar.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

class PlaceTagger(private val context: Context) {

    val permissions: Array<String> = arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )

    val backgroundPermission: String? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) Manifest.permission.ACCESS_BACKGROUND_LOCATION else null

    fun hasPermission(): Boolean = permissions.any {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    suspend fun currentCity(): String? {
        if (!hasPermission()) return null
        val manager = context.getSystemService(LocationManager::class.java) ?: return null
        val location = suspendCancellableCoroutine<Location?> { continuation ->
            val signal = CancellationSignal()
            continuation.invokeOnCancellation { signal.cancel() }
            LocationManagerCompat.getCurrentLocation(
                manager,
                LocationManager.NETWORK_PROVIDER,
                signal,
                ContextCompat.getMainExecutor(context),
            ) { continuation.resume(it) }
        } ?: return null
        return withContext(Dispatchers.IO) { cityFor(location) }
    }

    @Suppress("DEPRECATION")
    private fun cityFor(location: Location): String? = runCatching {
        Geocoder(context).getFromLocation(location.latitude, location.longitude, 1)
            ?.firstOrNull()
            ?.locality
    }.getOrNull()
}
