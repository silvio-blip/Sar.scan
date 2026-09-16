package com.aistudio.sarscan.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = MossPrimary,
    onPrimary = CardWhite,
    primaryContainer = MossPrimaryLight,
    onPrimaryContainer = CardWhite,
    secondary = AlmondSecondary,
    onSecondary = MossPrimaryDark,
    tertiary = ApricotAccent,
    onTertiary = CardWhite,
    background = LinenBackground,
    onBackground = CharcoalText,
    surface = CardWhite,
    onSurface = CharcoalText,
    surfaceVariant = AlmondSecondary,
    onSurfaceVariant = CharcoalText,
    outline = SageMuted.copy(alpha = 0.3f)
)

@Composable
fun SarScanTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = true
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
