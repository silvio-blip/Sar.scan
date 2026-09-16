package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.DailyGoalEntity
import com.example.data.FoodEntryEntity
import com.example.data.WeeklyDayStat
import com.example.ui.components.*
import com.example.ui.theme.*

@Composable
fun DiarioScreen(
    entries: List<FoodEntryEntity>,
    dailyGoal: DailyGoalEntity?,
    waterIntake: Int,
    weeklyStats: List<WeeklyDayStat>,
    onAddWater: (Int) -> Unit,
    onRemoveWater: () -> Unit,
    onDeleteEntry: (Long) -> Unit,
    onNavigateToScanner: () -> Unit,
    onNavigateToBuscar: () -> Unit,
    modifier: Modifier = Modifier
) {
    val goal = dailyGoal ?: DailyGoalEntity()
    val totalCal = entries.sumOf { it.calorias }
    val totalProt = entries.sumOf { it.prot }
    val totalCarbs = entries.sumOf { it.carbs }
    val totalFat = entries.sumOf { it.gord }

    var selectedEntryForDetail by remember { mutableStateOf<FoodEntryEntity?>(null) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Daily Macronutrient Gauge
        item {
            MacroGauge(
                consumedCalories = totalCal,
                targetCalories = goal.calorias,
                consumedProt = totalProt,
                targetProt = goal.proteinaG,
                consumedCarbs = totalCarbs,
                targetCarbs = goal.carbsG,
                consumedFat = totalFat,
                targetFat = goal.gorduraG
            )
        }

        // 2. Water Tracker Card
        item {
            WaterTrackerCard(
                currentMl = waterIntake,
                targetMl = goal.waterMl,
                onAddWater = onAddWater,
                onRemoveWater = onRemoveWater
            )
        }

        // 3. Meal Sections Header
        item {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
            ) {
                Text(
                    text = "Refeições de Hoje",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilledTonalButton(
                        onClick = onNavigateToBuscar,
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.testTag("add_meal_button")
                    ) {
                        Icon(imageVector = Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Adicionar", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        // 4. Meal list
        if (entries.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.fillMaxWidth().padding(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.RestaurantMenu,
                            contentDescription = null,
                            tint = MossGreenPrimary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Nenhuma refeição registrada hoje",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Escaneie um prato com a IA ou busque alimentos para registrar calorias e macros.",
                            style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = onNavigateToScanner,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary),
                            modifier = Modifier.testTag("empty_state_scan_button")
                        ) {
                            Icon(imageVector = Icons.Filled.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Escanear Alimento com IA", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        } else {
            val meals = listOf("Café da Manhã", "Almoço", "Jantar", "Lanches")
            meals.forEach { mealType ->
                val mealEntries = entries.filter { it.mealType == mealType }
                if (mealEntries.isNotEmpty()) {
                    val mealCal = mealEntries.sumOf { it.calorias }
                    item {
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp)
                        ) {
                            Text(
                                text = mealType,
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                            )
                            Text(
                                text = "$mealCal kcal",
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontWeight = FontWeight.SemiBold,
                                    color = MossGreenPrimary
                                )
                            )
                        }
                    }

                    items(mealEntries, key = { it.id }) { entry ->
                        FoodEntryItemCard(
                            entry = entry,
                            onClick = { selectedEntryForDetail = entry },
                            onDelete = { onDeleteEntry(entry.id) }
                        )
                    }
                }
            }
        }

        // 5. Weekly Evolution Charts
        item {
            Spacer(modifier = Modifier.height(8.dp))
            WeeklyEvolutionChart(
                weeklyStats = weeklyStats,
                targetCalories = goal.calorias
            )
        }
    }

    // Food Entry Detail Dialog
    selectedEntryForDetail?.let { entry ->
        AlertDialog(
            onDismissRequest = { selectedEntryForDetail = null },
            title = {
                Text(
                    text = entry.nome,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Refeição: ${entry.mealType}",
                        style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary)
                    )
                    HorizontalDivider(color = BorderSubtle)
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Calorias Totais", fontWeight = FontWeight.SemiBold)
                        Text("${entry.calorias} kcal", fontWeight = FontWeight.Bold, color = MossGreenPrimary)
                    }
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Proteínas", color = MacroProteinColor)
                        Text("${entry.prot}g", fontWeight = FontWeight.Bold)
                    }
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Carboidratos", color = MacroCarbsColor)
                        Text("${entry.carbs}g", fontWeight = FontWeight.Bold)
                    }
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Gorduras", color = MacroFatColor)
                        Text("${entry.gord}g", fontWeight = FontWeight.Bold)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { selectedEntryForDetail = null },
                    colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary)
                ) {
                    Text("Fechar")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        onDeleteEntry(entry.id)
                        selectedEntryForDetail = null
                    }
                ) {
                    Text("Excluir", color = MaterialTheme.colorScheme.error)
                }
            }
        )
    }
}
