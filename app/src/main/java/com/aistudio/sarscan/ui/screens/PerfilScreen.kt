package com.aistudio.sarscan.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import com.aistudio.sarscan.ui.theme.AlmondSecondary
import com.aistudio.sarscan.ui.theme.ApricotAccent
import com.aistudio.sarscan.ui.theme.CardWhite
import com.aistudio.sarscan.ui.theme.CharcoalText
import com.aistudio.sarscan.ui.theme.LinenBackground
import com.aistudio.sarscan.ui.theme.MossPrimary
import com.aistudio.sarscan.ui.theme.MossPrimaryDark
import com.aistudio.sarscan.ui.theme.TextMuted
import com.aistudio.sarscan.ui.theme.WaterBlue
import com.aistudio.sarscan.viewmodel.NutritionViewModel

@Composable
fun PerfilScreen(
    viewModel: NutritionViewModel,
    modifier: Modifier = Modifier
) {
    val profile by viewModel.userProfile.collectAsState()

    var name by remember(profile) { mutableStateOf(profile.name) }
    var weight by remember(profile) { mutableStateOf(profile.weightKg.toString()) }
    var height by remember(profile) { mutableStateOf(profile.heightCm.toInt().toString()) }
    var age by remember(profile) { mutableStateOf(profile.age.toString()) }
    var goal by remember(profile) { mutableStateOf(profile.goal) }
    var targetCalories by remember(profile) { mutableStateOf(profile.targetCalories.toString()) }
    var targetWater by remember(profile) { mutableStateOf(profile.targetWaterMl.toString()) }
    var targetProtein by remember(profile) { mutableStateOf(profile.targetProteinG.toString()) }
    var targetCarbs by remember(profile) { mutableStateOf(profile.targetCarbsG.toString()) }
    var targetFat by remember(profile) { mutableStateOf(profile.targetFatG.toString()) }

    var saveFeedback by remember { mutableStateOf(false) }

    val goals = listOf("Perder peso", "Manter peso", "Ganhar massa")

    fun onGoalSelected(newGoal: String) {
        goal = newGoal
        val w = weight.toFloatOrNull() ?: 70f
        when (newGoal) {
            "Perder peso" -> {
                targetCalories = (w * 24).toInt().toString()
                targetProtein = (w * 2.0).toInt().toString()
                targetCarbs = (w * 2.5).toInt().toString()
                targetFat = (w * 0.8).toInt().toString()
            }
            "Ganhar massa" -> {
                targetCalories = (w * 35).toInt().toString()
                targetProtein = (w * 2.2).toInt().toString()
                targetCarbs = (w * 4.5).toInt().toString()
                targetFat = (w * 1.0).toInt().toString()
            }
            else -> {
                targetCalories = (w * 30).toInt().toString()
                targetProtein = (w * 1.8).toInt().toString()
                targetCarbs = (w * 3.5).toInt().toString()
                targetFat = (w * 0.9).toInt().toString()
            }
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(LinenBackground)
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Column {
                Text(
                    text = "Perfil e Metas",
                    style = MaterialTheme.typography.headlineLarge.copy(
                        color = MossPrimaryDark,
                        fontWeight = FontWeight.ExtraBold
                    )
                )
                Text(
                    text = "Personalize seus objetivos nutricionais",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        // Stats Cards: Streaks and Scans
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = CardWhite)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(ApricotAccent.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocalFireDepartment,
                                contentDescription = null,
                                tint = ApricotAccent
                            )
                        }
                        Text(
                            text = "${profile.streakDays} dias",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold)
                        )
                        Text(
                            text = "Sequência ativa",
                            style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
                        )
                    }
                }

                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = CardWhite)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(MossPrimary.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.QrCodeScanner,
                                contentDescription = null,
                                tint = MossPrimary
                            )
                        }
                        Text(
                            text = "${profile.totalScans} pratos",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold)
                        )
                        Text(
                            text = "Escaneados com IA",
                            style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
                        )
                    }
                }
            }
        }

        // Objective Selector
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CardWhite)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Objetivo Atual",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        goals.forEach { g ->
                            val isSelected = goal == g
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) MossPrimary else AlmondSecondary)
                                    .clickable { onGoalSelected(g) }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = g,
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSelected) CardWhite else CharcoalText
                                    )
                                )
                            }
                        }
                    }
                }
            }
        }

        // Physical data Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CardWhite)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Dados Corporais",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )

                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Nome") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = weight,
                            onValueChange = { weight = it },
                            label = { Text("Peso (kg)") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = height,
                            onValueChange = { height = it },
                            label = { Text("Altura (cm)") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = age,
                            onValueChange = { age = it },
                            label = { Text("Idade") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        // Macro & Calorie Targets
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CardWhite)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Metas Nutricionais Diárias",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = targetCalories,
                            onValueChange = { targetCalories = it },
                            label = { Text("Calorias (kcal)") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = targetWater,
                            onValueChange = { targetWater = it },
                            label = { Text("Água (ml)") },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = targetCarbs,
                            onValueChange = { targetCarbs = it },
                            label = { Text("Carbos (g)") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = targetProtein,
                            onValueChange = { targetProtein = it },
                            label = { Text("Prot (g)") },
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = targetFat,
                            onValueChange = { targetFat = it },
                            label = { Text("Gord (g)") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        // Save Button
        item {
            Button(
                onClick = {
                    val updated = profile.copy(
                        name = name,
                        weightKg = weight.toFloatOrNull() ?: profile.weightKg,
                        heightCm = height.toFloatOrNull() ?: profile.heightCm,
                        age = age.toIntOrNull() ?: profile.age,
                        goal = goal,
                        targetCalories = targetCalories.toIntOrNull() ?: profile.targetCalories,
                        targetWaterMl = targetWater.toIntOrNull() ?: profile.targetWaterMl,
                        targetProteinG = targetProtein.toIntOrNull() ?: profile.targetProteinG,
                        targetCarbsG = targetCarbs.toIntOrNull() ?: profile.targetCarbsG,
                        targetFatG = targetFat.toIntOrNull() ?: profile.targetFatG
                    )
                    viewModel.updateProfile(updated)
                    saveFeedback = true
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("save_profile_button"),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MossPrimary,
                    contentColor = CardWhite
                )
            ) {
                Icon(imageVector = Icons.Default.Check, contentDescription = null)
                Spacer(modifier = Modifier.size(8.dp))
                Text(
                    text = if (saveFeedback) "Alterações Salvas!" else "Salvar Metas",
                    style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold)
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
