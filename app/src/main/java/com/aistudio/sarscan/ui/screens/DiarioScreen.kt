package com.aistudio.sarscan.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.sarscan.data.model.FoodEntry
import com.aistudio.sarscan.ui.components.CalorieGaugeCard
import com.aistudio.sarscan.ui.components.MacroBreakdownCard
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
import com.aistudio.sarscan.ui.theme.TextMuted
import com.aistudio.sarscan.viewmodel.NutritionViewModel

@Composable
fun DiarioScreen(
    viewModel: NutritionViewModel,
    modifier: Modifier = Modifier
) {
    val entries by viewModel.todayEntries.collectAsState()
    val totalCalories by viewModel.todayCalories.collectAsState()
    val totalCarbs by viewModel.todayCarbs.collectAsState()
    val totalProtein by viewModel.todayProtein.collectAsState()
    val totalFat by viewModel.todayFat.collectAsState()
    val userProfile by viewModel.userProfile.collectAsState()

    var showAddManualDialog by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(LinenBackground)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Diário Calórico",
                            style = MaterialTheme.typography.headlineLarge.copy(
                                color = MossPrimaryDark,
                                fontWeight = FontWeight.ExtraBold
                            )
                        )
                        Text(
                            text = "Acompanhe seu consumo diário e metas",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(AlmondSecondary)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CalendarToday,
                                contentDescription = null,
                                tint = MossPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "Hoje",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = MossPrimary
                                )
                            )
                        }
                    }
                }
            }

            // Calorie Gauge
            item {
                CalorieGaugeCard(
                    consumedCalories = totalCalories ?: 0.0,
                    targetCalories = userProfile.targetCalories
                )
            }

            // Macro Breakdown
            item {
                MacroBreakdownCard(
                    carbsG = totalCarbs ?: 0.0,
                    targetCarbsG = userProfile.targetCarbsG,
                    proteinG = totalProtein ?: 0.0,
                    targetProteinG = userProfile.targetProteinG,
                    fatG = totalFat ?: 0.0,
                    targetFatG = userProfile.targetFatG
                )
            }

            // Section Header: Alimentos de Hoje
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Refeições Registradas (${entries.size})",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = CharcoalText
                        )
                    )
                    TextButton(onClick = { showAddManualDialog = true }) {
                        Text("+ Adicionar manual", color = MossPrimary)
                    }
                }
            }

            if (entries.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = CardWhite)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Fastfood,
                                contentDescription = null,
                                tint = SageMuted,
                                modifier = Modifier.size(48.dp)
                            )
                            Text(
                                text = "Nenhum alimento registrado hoje",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                            Text(
                                text = "Use o scanner de IA ou a aba Buscar para registrar suas refeições.",
                                style = MaterialTheme.typography.bodyMedium.copy(color = TextMuted)
                            )
                        }
                    }
                }
            } else {
                items(entries, key = { it.id }) { entry ->
                    FoodEntryCard(
                        entry = entry,
                        onDelete = { viewModel.deleteFood(entry) }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(72.dp))
            }
        }

        // Floating Action Button to quickly add food
        FloatingActionButton(
            onClick = { showAddManualDialog = true },
            containerColor = MossPrimary,
            contentColor = CardWhite,
            shape = CircleShape,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(24.dp)
                .testTag("add_manual_food_fab")
        ) {
            Icon(imageVector = Icons.Default.Add, contentDescription = "Adicionar alimento")
        }
    }

    if (showAddManualDialog) {
        AddManualFoodDialog(
            onDismiss = { showAddManualDialog = false },
            onConfirm = { name, calories, carbs, protein, fat, portion, mealType ->
                viewModel.addManualFood(name, calories, carbs, protein, fat, portion, mealType)
                showAddManualDialog = false
            }
        )
    }
}

@Composable
fun FoodEntryCard(
    entry: FoodEntry,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CardWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = entry.name,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(AlmondSecondary)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = entry.mealType,
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold)
                        )
                    }
                }

                Text(
                    text = "Porção: ${entry.portion}",
                    style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
                )

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "C: ${entry.carbs.toInt()}g",
                        style = MaterialTheme.typography.labelSmall.copy(color = CarbsColor, fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = "P: ${entry.protein.toInt()}g",
                        style = MaterialTheme.typography.labelSmall.copy(color = ProteinColor, fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = "G: ${entry.fat.toInt()}g",
                        style = MaterialTheme.typography.labelSmall.copy(color = FatColor, fontWeight = FontWeight.Bold)
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${entry.calories.toInt()} kcal",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MossPrimary
                    )
                )
                IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Excluir",
                        tint = TextMuted.copy(alpha = 0.6f),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun AddManualFoodDialog(
    onDismiss: () -> Unit,
    onConfirm: (name: String, calories: Double, carbs: Double, protein: Double, fat: Double, portion: String, mealType: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var calories by remember { mutableStateOf("") }
    var carbs by remember { mutableStateOf("") }
    var protein by remember { mutableStateOf("") }
    var fat by remember { mutableStateOf("") }
    var portion by remember { mutableStateOf("100g") }
    var mealType by remember { mutableStateOf("Almoço") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Adicionar Refeição",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome do alimento") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("manual_food_name")
                )
                OutlinedTextField(
                    value = calories,
                    onValueChange = { calories = it },
                    label = { Text("Calorias (kcal)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("manual_food_calories")
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = carbs,
                        onValueChange = { carbs = it },
                        label = { Text("Carbos (g)") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = protein,
                        onValueChange = { protein = it },
                        label = { Text("Prot (g)") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = fat,
                        onValueChange = { fat = it },
                        label = { Text("Gord (g)") },
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = portion,
                    onValueChange = { portion = it },
                    label = { Text("Porção (ex: 150g, 1 prato)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cal = calories.toDoubleOrNull() ?: 0.0
                    val c = carbs.toDoubleOrNull() ?: 0.0
                    val p = protein.toDoubleOrNull() ?: 0.0
                    val f = fat.toDoubleOrNull() ?: 0.0
                    if (name.isNotBlank()) {
                        onConfirm(name, cal, c, p, f, portion, mealType)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MossPrimary)
            ) {
                Text("Adicionar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}
