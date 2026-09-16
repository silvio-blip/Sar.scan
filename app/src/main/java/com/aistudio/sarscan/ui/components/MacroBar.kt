package com.aistudio.sarscan.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aistudio.sarscan.ui.theme.AlmondSecondary
import com.aistudio.sarscan.ui.theme.CardWhite
import com.aistudio.sarscan.ui.theme.CarbsColor
import com.aistudio.sarscan.ui.theme.CharcoalText
import com.aistudio.sarscan.ui.theme.FatColor
import com.aistudio.sarscan.ui.theme.ProteinColor
import com.aistudio.sarscan.ui.theme.TextMuted

@Composable
fun MacroBreakdownCard(
    carbsG: Double,
    targetCarbsG: Int,
    proteinG: Double,
    targetProteinG: Int,
    fatG: Double,
    targetFatG: Int,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = CardWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "Macronutrientes",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = CharcoalText
                )
            )

            MacroProgressBar(
                label = "Carboidratos",
                currentGrams = carbsG,
                targetGrams = targetCarbsG,
                color = CarbsColor
            )

            MacroProgressBar(
                label = "Proteínas",
                currentGrams = proteinG,
                targetGrams = targetProteinG,
                color = ProteinColor
            )

            MacroProgressBar(
                label = "Gorduras",
                currentGrams = fatG,
                targetGrams = targetFatG,
                color = FatColor
            )
        }
    }
}

@Composable
fun MacroProgressBar(
    label: String,
    currentGrams: Double,
    targetGrams: Int,
    color: Color
) {
    val progress = if (targetGrams > 0) (currentGrams / targetGrams).toFloat().coerceIn(0f, 1f) else 0f

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium)
            )
            Text(
                text = "${currentGrams.toInt()}g / ${targetGrams}g",
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold)
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(AlmondSecondary)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(progress)
                    .clip(RoundedCornerShape(4.dp))
                    .background(color)
            )
        }
    }
}
