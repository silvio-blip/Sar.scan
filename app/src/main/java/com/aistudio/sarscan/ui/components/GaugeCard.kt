package com.aistudio.sarscan.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.sarscan.ui.theme.AlmondSecondary
import com.aistudio.sarscan.ui.theme.ApricotAccent
import com.aistudio.sarscan.ui.theme.CardWhite
import com.aistudio.sarscan.ui.theme.CharcoalText
import com.aistudio.sarscan.ui.theme.MossPrimary
import com.aistudio.sarscan.ui.theme.TextMuted
import kotlin.math.max

@Composable
fun CalorieGaugeCard(
    consumedCalories: Double,
    targetCalories: Int,
    modifier: Modifier = Modifier
) {
    val remaining = max(0.0, targetCalories - consumedCalories)
    val progress = (consumedCalories / targetCalories).toFloat().coerceIn(0f, 1.2f)
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(800),
        label = "calorie_progress"
    )

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = CardWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Circular Progress Indicator with text in center
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(130.dp)
            ) {
                Canvas(modifier = Modifier.size(120.dp)) {
                    val strokeWidth = 14.dp.toPx()
                    // Background track
                    drawArc(
                        color = AlmondSecondary,
                        startAngle = -90f,
                        sweepAngle = 360f,
                        useCenter = false,
                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                    )
                    // Progress arc
                    val sweep = (animatedProgress.coerceAtMost(1f)) * 360f
                    drawArc(
                        color = if (animatedProgress > 1f) ApricotAccent else MossPrimary,
                        startAngle = -90f,
                        sweepAngle = sweep,
                        useCenter = false,
                        style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = consumedCalories.toInt().toString(),
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = CharcoalText,
                            fontSize = 24.sp
                        )
                    )
                    Text(
                        text = "kcal consumidas",
                        style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
                    )
                }
            }

            // Stats breakdown (Meta vs Restante)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Column {
                    Text(
                        text = "Meta Diária",
                        style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
                    )
                    Text(
                        text = "$targetCalories kcal",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = CharcoalText
                        )
                    )
                }

                Column {
                    Text(
                        text = "Restantes",
                        style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
                    )
                    Text(
                        text = "${remaining.toInt()} kcal",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = if (remaining > 0) MossPrimary else ApricotAccent
                        )
                    )
                }
            }
        }
    }
}
