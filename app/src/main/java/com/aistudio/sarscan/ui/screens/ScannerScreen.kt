package com.aistudio.sarscan.ui.screens

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EmojiObjects
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.sarscan.ui.components.WaterTrackerCard
import com.aistudio.sarscan.ui.theme.AlmondSecondary
import com.aistudio.sarscan.ui.theme.ApricotAccent
import com.aistudio.sarscan.ui.theme.CardWhite
import com.aistudio.sarscan.ui.theme.CarbsColor
import com.aistudio.sarscan.ui.theme.CharcoalText
import com.aistudio.sarscan.ui.theme.FatColor
import com.aistudio.sarscan.ui.theme.LinenBackground
import com.aistudio.sarscan.ui.theme.MossPrimary
import com.aistudio.sarscan.ui.theme.MossPrimaryDark
import com.aistudio.sarscan.ui.theme.ProteinColor
import com.aistudio.sarscan.ui.theme.SageMuted
import com.aistudio.sarscan.ui.theme.TextMuted
import com.aistudio.sarscan.viewmodel.NutritionViewModel
import com.aistudio.sarscan.viewmodel.ScannerUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScannerScreen(
    viewModel: NutritionViewModel,
    modifier: Modifier = Modifier
) {
    val scannerState by viewModel.scannerState.collectAsState()
    val waterTotal by viewModel.todayWaterTotal.collectAsState()
    val userProfile by viewModel.userProfile.collectAsState()

    var selectedMealType by remember { mutableStateOf("Almoço") }

    val infiniteTransition = rememberInfiniteTransition(label = "scanner_laser")
    val laserOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "laser_y"
    )

    // Helper to generate sample food bitmap for instant AI test
    val triggerSampleScan = {
        val bmp = Bitmap.createBitmap(400, 400, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val paint = Paint().apply { color = android.graphics.Color.rgb(46, 74, 59) }
        canvas.drawCircle(200f, 200f, 180f, paint)
        viewModel.scanBitmap(bmp)
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(LinenBackground)
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Column {
                Text(
                    text = "Sar.scan IA",
                    style = MaterialTheme.typography.headlineLarge.copy(
                        color = MossPrimaryDark,
                        fontWeight = FontWeight.ExtraBold
                    )
                )
                Text(
                    text = "Aponte para o seu prato e analise calorias em segundos",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // Viewfinder Card
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MossPrimaryDark)
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    // Scanning laser animation
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(2.dp)
                            .padding(top = (laserOffset * 280).dp)
                            .background(
                                Brush.horizontalGradient(
                                    listOf(Color.Transparent, ApricotAccent, ApricotAccent, Color.Transparent)
                                )
                            )
                    )

                    // Target Viewfinder Reticle
                    Box(
                        modifier = Modifier
                            .size(200.dp)
                            .align(Alignment.Center)
                            .border(2.dp, ApricotAccent.copy(alpha = 0.6f), RoundedCornerShape(16.dp))
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.Restaurant,
                                contentDescription = "Enquadre seu prato",
                                tint = CardWhite.copy(alpha = 0.5f),
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Enquadre sua refeição",
                                style = MaterialTheme.typography.labelSmall.copy(color = CardWhite.copy(alpha = 0.8f))
                            )
                        }
                    }

                    // Scanner state indicator
                    if (scannerState is ScannerUiState.Scanning) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color.Black.copy(alpha = 0.6f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                CircularProgressIndicator(color = ApricotAccent)
                                Text(
                                    text = "Analisando com Gemini IA…",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = CardWhite,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                        }
                    }
                }
            }
        }

        // Action Buttons: Tirar Foto & Teste Rápido
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = { triggerSampleScan() },
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("scan_food_button"),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MossPrimary,
                        contentColor = CardWhite
                    )
                ) {
                    Icon(imageVector = Icons.Default.CameraAlt, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text(
                        text = "Escanear Foto",
                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold)
                    )
                }

                OutlinedButton(
                    onClick = { triggerSampleScan() },
                    modifier = Modifier
                        .height(52.dp)
                        .testTag("gallery_button"),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(imageVector = Icons.Default.PhotoLibrary, contentDescription = "Galeria", tint = MossPrimary)
                }
            }
        }

        // Nutrition Tip of the day
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = AlmondSecondary)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(ApricotAccent.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.EmojiObjects,
                            contentDescription = null,
                            tint = ApricotAccent
                        )
                    }
                    Column {
                        Text(
                            text = "Dica Nutricional Sar.scan",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Escaneie fotos com boa iluminação e com todos os alimentos visíveis para estimativas ainda mais precisas.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }

        // Hydration Widget
        item {
            WaterTrackerCard(
                currentMl = waterTotal ?: 0,
                targetMl = userProfile.targetWaterMl,
                onAddWater = { viewModel.addWater(it) },
                onRemoveLatest = { viewModel.removeLatestWater() }
            )
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    // Modal Bottom Sheet showing AI scanned items
    if (scannerState is ScannerUiState.Success) {
        val analysis = (scannerState as ScannerUiState.Success).analysis
        val selected = (scannerState as ScannerUiState.Success).selectedItems

        ModalBottomSheet(
            onDismissRequest = { viewModel.dismissScanner() },
            containerColor = CardWhite,
            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = analysis.mealName,
                            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Text(
                            text = analysis.portionDescription,
                            style = MaterialTheme.typography.bodyMedium.copy(color = TextMuted)
                        )
                    }
                    IconButton(onClick = { viewModel.dismissScanner() }) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Fechar")
                    }
                }

                // Macro summary pill
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(AlmondSecondary)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Calorias", style = MaterialTheme.typography.labelSmall)
                        Text(
                            text = "${analysis.estimatedCalories.toInt()} kcal",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Carbos", style = MaterialTheme.typography.labelSmall, color = CarbsColor)
                        Text(
                            text = "${analysis.carbsGrams.toInt()}g",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Proteína", style = MaterialTheme.typography.labelSmall, color = ProteinColor)
                        Text(
                            text = "${analysis.proteinGrams.toInt()}g",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "Gorduras", style = MaterialTheme.typography.labelSmall, color = FatColor)
                        Text(
                            text = "${analysis.fatGrams.toInt()}g",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                }

                // Items list with checkboxes
                Text(
                    text = "Alimentos identificados:",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                )

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    analysis.items.forEachIndexed { index, item ->
                        val isChecked = selected.contains(index)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isChecked) AlmondSecondary else CardWhite)
                                .clickable { viewModel.toggleItemSelection(index) }
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = isChecked,
                                onCheckedChange = { viewModel.toggleItemSelection(index) },
                                colors = CheckboxDefaults.colors(checkedColor = MossPrimary)
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.name,
                                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium)
                                )
                                Text(
                                    text = "${item.portion} • ${item.calories.toInt()} kcal (P: ${item.protein.toInt()}g | C: ${item.carbs.toInt()}g | G: ${item.fat.toInt()}g)",
                                    style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
                                )
                            }
                        }
                    }
                }

                // Meal Type selector
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("Café", "Almoço", "Jantar", "Lanche").forEach { meal ->
                        val isSelected = selectedMealType.startsWith(meal)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (isSelected) MossPrimary else AlmondSecondary)
                                .clickable { selectedMealType = meal }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = meal,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) CardWhite else CharcoalText
                                )
                            )
                        }
                    }
                }

                Button(
                    onClick = { viewModel.confirmScannedFoods(selectedMealType) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .testTag("confirm_scan_button"),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MossPrimary,
                        contentColor = CardWhite
                    )
                ) {
                    Icon(imageVector = Icons.Default.Check, contentDescription = null)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text(
                        text = "Registrar no Diário",
                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }
        }
    }
}
