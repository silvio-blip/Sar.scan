package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.ScannedFoodResult
import com.example.ui.theme.*

@Composable
fun ScannerScreen(
    isScanning: Boolean,
    scannedResult: ScannedFoodResult?,
    onPerformScan: (String?) -> Unit,
    onSaveScannedMeal: (mealType: String, portion: Double) -> Unit,
    onClearScan: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedMealType by remember { mutableStateOf("Almoço") }
    var portionMultiplier by remember { mutableStateOf(1.0) }
    var customDishInput by remember { mutableStateOf("") }
    val mealTypes = listOf("Café da Manhã", "Almoço", "Jantar", "Lanches")

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Scanner Viewfinder Area
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF16251D)),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(310.dp)
                .testTag("scanner_viewfinder")
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                // Background subtle food glow
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.radialGradient(
                                colors = listOf(Color(0xFF264635), Color(0xFF101C15)),
                                radius = 600f
                            )
                        )
                )

                // Viewfinder Reticle / Corner brackets
                Canvas(modifier = Modifier.fillMaxSize().padding(32.dp)) {
                    val stroke = 3.dp.toPx()
                    val bracketLen = 30.dp.toPx()
                    val color = if (isScanning) ApricotAccent else MossGreenLight

                    // Top Left
                    drawLine(color, Offset(0f, 0f), Offset(bracketLen, 0f), stroke)
                    drawLine(color, Offset(0f, 0f), Offset(0f, bracketLen), stroke)

                    // Top Right
                    drawLine(color, Offset(size.width, 0f), Offset(size.width - bracketLen, 0f), stroke)
                    drawLine(color, Offset(size.width, 0f), Offset(size.width, bracketLen), stroke)

                    // Bottom Left
                    drawLine(color, Offset(0f, size.height), Offset(bracketLen, size.height), stroke)
                    drawLine(color, Offset(0f, size.height), Offset(0f, size.height - bracketLen), stroke)

                    // Bottom Right
                    drawLine(color, Offset(size.width, size.height), Offset(size.width - bracketLen, size.height), stroke)
                    drawLine(color, Offset(size.width, size.height), Offset(size.width, size.height - bracketLen), stroke)
                }

                // Laser Scanning Bar Animation
                if (isScanning) {
                    val infiniteTransition = rememberInfiniteTransition(label = "laser_transition")
                    val laserY by infiniteTransition.animateFloat(
                        initialValue = 0.1f,
                        targetValue = 0.9f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(1200, easing = LinearEasing),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "laser_y"
                    )

                    Canvas(modifier = Modifier.fillMaxSize().padding(horizontal = 36.dp)) {
                        val y = size.height * laserY
                        drawLine(
                            brush = Brush.horizontalGradient(
                                listOf(Color.Transparent, ApricotAccent, Color.White, ApricotAccent, Color.Transparent)
                            ),
                            start = Offset(0f, y),
                            end = Offset(size.width, y),
                            strokeWidth = 4.dp.toPx()
                        )
                    }
                }

                // Center Icon / Overlay Text
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxSize().padding(24.dp)
                ) {
                    if (isScanning) {
                        CircularProgressIndicator(
                            color = ApricotAccent,
                            strokeWidth = 3.dp,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Analisando nutrientes com IA...",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                        Text(
                            text = "Detectando alimentos, porções e calorias",
                            style = MaterialTheme.typography.bodyMedium.copy(color = Color(0xFFA5C4B4))
                        )
                    } else if (scannedResult != null) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0x332E4A3B),
                            modifier = Modifier.padding(bottom = 8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = MossGreenLight, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Confiança: ${scannedResult.confidence}%",
                                    style = MaterialTheme.typography.labelMedium.copy(color = Color.White, fontWeight = FontWeight.Bold)
                                )
                            }
                        }
                        Text(
                            text = scannedResult.title,
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            ),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "${scannedResult.totalCalories} kcal • ${scannedResult.totalProtein}g prot",
                            style = MaterialTheme.typography.bodyMedium.copy(color = ApricotAccent, fontWeight = FontWeight.SemiBold)
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Outlined.DocumentScanner,
                            contentDescription = null,
                            tint = MossGreenLight,
                            modifier = Modifier.size(56.dp)
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = "Aponte a câmera para o prato",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "O Sar.scan identifica ingredientes e calcula calorias automaticamente",
                            style = MaterialTheme.typography.bodyMedium.copy(color = Color(0xFFA5C4B4)),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Quick Preset Sample Dishes
        Text(
            text = "Ou teste um prato de exemplo:",
            style = MaterialTheme.typography.labelMedium.copy(color = TextSecondary),
            modifier = Modifier.align(Alignment.Start).padding(start = 4.dp, bottom = 8.dp)
        )

        val sampleDishes = listOf(
            "Prato Executivo Fitness",
            "Salada Caesar com Frango",
            "Café com Ovos & Tapioca",
            "Bowl de Açaí com Banana"
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(sampleDishes) { dish ->
                SuggestionChip(
                    onClick = { onPerformScan(dish) },
                    label = { Text(dish, fontSize = 12.sp) },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = LinenCreamSurfaceVariant,
                        labelColor = TextPrimary
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Scan Action Button
        Button(
            onClick = { onPerformScan(customDishInput.ifBlank { null }) },
            enabled = !isScanning,
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary),
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .testTag("start_scan_button")
        ) {
            Icon(imageVector = Icons.Filled.CameraAlt, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = if (isScanning) "Processando com IA..." else "Escanear Alimento Agora",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
            )
        }

        // Scanned Result Breakdown Card
        AnimatedVisibility(visible = scannedResult != null) {
            scannedResult?.let { result ->
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp)
                        .testTag("scan_result_card")
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = result.title,
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                )
                                Text(
                                    text = result.description,
                                    style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary)
                                )
                            }
                            IconButton(onClick = onClearScan) {
                                Icon(Icons.Filled.Close, contentDescription = "Limpar resultado", tint = TextSecondary)
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))
                        HorizontalDivider(color = BorderSubtle)
                        Spacer(modifier = Modifier.height(14.dp))

                        // Macro Badges
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MossGreenContainer,
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier.padding(vertical = 10.dp)
                                ) {
                                    Text(
                                        text = "${(result.totalCalories * portionMultiplier).toInt()}",
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = MossGreenPrimary
                                        )
                                    )
                                    Text("kcal", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                }
                            }

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = ApricotContainer,
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier.padding(vertical = 10.dp)
                                ) {
                                    Text(
                                        text = "${(result.totalProtein * portionMultiplier).toInt()}g",
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = ApricotAccentDark
                                        )
                                    )
                                    Text("Proteína", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                }
                            }

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = LinenCreamSurfaceVariant,
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier.padding(vertical = 10.dp)
                                ) {
                                    Text(
                                        text = "${(result.totalCarbs * portionMultiplier).toInt()}g",
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = MacroCarbsColor
                                        )
                                    )
                                    Text("Carbos", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                }
                            }

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = LinenCreamSurfaceVariant,
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier.padding(vertical = 10.dp)
                                ) {
                                    Text(
                                        text = "${(result.totalFat * portionMultiplier).toInt()}g",
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = MacroFatColor
                                        )
                                    )
                                    Text("Gordura", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Breakdown Items List
                        Text(
                            text = "Itens Identificados no Prato:",
                            style = MaterialTheme.typography.labelLarge.copy(color = TextPrimary)
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        result.items.forEach { item ->
                            Row(
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.name, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
                                    Text("${item.portion} • P: ${item.protein}g | C: ${item.carbs}g", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                }
                                Text("${item.calories} kcal", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = MossGreenPrimary))
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Meal Type Selector Chips
                        Text(
                            text = "Registrar como:",
                            style = MaterialTheme.typography.labelMedium.copy(color = TextSecondary)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            mealTypes.forEach { type ->
                                FilterChip(
                                    selected = selectedMealType == type,
                                    onClick = { selectedMealType = type },
                                    label = { Text(type, fontSize = 11.sp) }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        // Save to Diary Button
                        Button(
                            onClick = { onSaveScannedMeal(selectedMealType, portionMultiplier) },
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .testTag("save_scanned_meal_button")
                        ) {
                            Icon(Icons.Filled.AddCircleOutline, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Adicionar ao Diário de Hoje", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}
