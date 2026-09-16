package com.example.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = MossGreenPrimary,
    onPrimary = Color.White,
    primaryContainer = MossGreenContainer,
    onPrimaryContainer = OnMossGreenContainer,
    secondary = ApricotAccent,
    onSecondary = Color.White,
    secondaryContainer = ApricotContainer,
    onSecondaryContainer = ApricotAccentDark,
    tertiary = WaterBlue,
    onTertiary = Color.White,
    tertiaryContainer = WaterBlueContainer,
    onTertiaryContainer = WaterBlueDark,
    background = LinenCreamBackground,
    onBackground = TextPrimary,
    surface = LinenCreamSurface,
    onSurface = TextPrimary,
    surfaceVariant = LinenCreamSurfaceVariant,
    onSurfaceVariant = TextSecondary,
    outline = BorderSubtle
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF74A88B),
    onPrimary = Color(0xFF10281C),
    primaryContainer = Color(0xFF223F30),
    onPrimaryContainer = Color(0xFFC7E3D3),
    secondary = ApricotAccent,
    onSecondary = Color.White,
    tertiary = WaterBlue,
    background = Color(0xFF121B16),
    onBackground = Color(0xFFE8EDE9),
    surface = Color(0xFF1A2620),
    onSurface = Color(0xFFE8EDE9),
    surfaceVariant = Color(0xFF24332B),
    onSurfaceVariant = Color(0xFFA3B8AC),
    outline = Color(0x33FFFFFF)
)

@Composable
fun SarScanTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
