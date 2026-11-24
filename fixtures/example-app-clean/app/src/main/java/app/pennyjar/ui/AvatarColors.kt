package app.pennyjar.ui

import androidx.compose.ui.graphics.Color
import kotlin.random.Random

object AvatarColors {

    private val palette = listOf(
        Color(0xFF2E7D5B),
        Color(0xFF3F6FB5),
        Color(0xFFB5543F),
        Color(0xFF8A5BB5),
        Color(0xFFB58A2E),
        Color(0xFF2E8A8A),
    )

    fun forName(name: String): Color =
        palette[Random(name.lowercase().hashCode()).nextInt(palette.size)]
}
