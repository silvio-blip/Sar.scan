package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.DailyGoalEntity
import com.example.data.UserProfileEntity
import com.example.ui.theme.*

@Composable
fun PerfilScreen(
    profile: UserProfileEntity?,
    dailyGoal: DailyGoalEntity?,
    onUpdateProfile: (UserProfileEntity) -> Unit,
    onUpdateGoals: (cal: Int, carbs: Int, prot: Int, fat: Int, water: Int) -> Unit,
    onOpenPremium: () -> Unit,
    modifier: Modifier = Modifier
) {
    val userProfile = profile ?: UserProfileEntity()
    val goal = dailyGoal ?: DailyGoalEntity()

    var showEditProfileDialog by remember { mutableStateOf(false) }
    var showEditGoalsDialog by remember { mutableStateOf(false) }

    // Calculate IMC / BMI
    val heightInMeters = userProfile.alturaCm / 100.0
    val imc = if (heightInMeters > 0) userProfile.pesoKg / (heightInMeters * heightInMeters) else 22.0
    val imcCategory = when {
        imc < 18.5 -> "Abaixo do peso"
        imc < 24.9 -> "Peso normal"
        imc < 29.9 -> "Sobrepeso"
        else -> "Obesidade"
    }

    // Calculate TMB / BMR (Harris-Benedict formula)
    val bmr = if (userProfile.genero == "Masculino") {
        (88.362 + (13.397 * userProfile.pesoKg) + (4.799 * userProfile.alturaCm) - (5.677 * userProfile.idade)).toInt()
    } else {
        (447.593 + (9.247 * userProfile.pesoKg) + (3.098 * userProfile.alturaCm) - (4.330 * userProfile.idade)).toInt()
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // User Profile Header Card
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth().testTag("profile_header_card")
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.linearGradient(listOf(MossGreenPrimary, ApricotAccent))
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = userProfile.nome.take(1).uppercase(),
                                    style = MaterialTheme.typography.headlineMedium.copy(
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column {
                                Text(
                                    text = userProfile.nome,
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                )
                                Text(
                                    text = userProfile.email,
                                    style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary)
                                )
                            }
                        }

                        IconButton(onClick = { showEditProfileDialog = true }) {
                            Icon(Icons.Outlined.Edit, contentDescription = "Editar Perfil", tint = MossGreenPrimary)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    HorizontalDivider(color = BorderSubtle)
                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column {
                            Text("Objetivo", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                            Text(userProfile.objetivo, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = MossGreenPrimary))
                        }
                        Column {
                            Text("Ofensiva / Streak", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.LocalFireDepartment, contentDescription = null, tint = ApricotAccent, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("${userProfile.streakDays} dias seguidos", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                            }
                        }
                    }
                }
            }
        }

        // Premium Banner Card
        item {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MossGreenPrimary),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenPremium() }
                    .testTag("premium_banner_card")
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().padding(18.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(ApricotAccent),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Filled.WorkspacePremium, contentDescription = null, tint = Color.White, modifier = Modifier.size(24.dp))
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Sar.scan Premium",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                        Text(
                            text = "Scans ilimitados com IA, planos de refeição e relatórios avançados.",
                            style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFFCCE4D6))
                        )
                    }
                    Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = Color.White)
                }
            }
        }

        // Physical & Metabolic Stats Card
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
                    Text(
                        text = "Métricas Corporais & Metabolismo",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    )
                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = LinenCreamSurfaceVariant,
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("Peso", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                Text("${userProfile.pesoKg} kg", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                            }
                        }
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = LinenCreamSurfaceVariant,
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("Altura", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                Text("${userProfile.alturaCm.toInt()} cm", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                            }
                        }
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = LinenCreamSurfaceVariant,
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("IMC", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                Text(String.format(java.util.Locale.US, "%.1f", imc), style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = MossGreenPrimary))
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = MossGreenContainer,
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("Taxa Basal (TMB)", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                Text("$bmr kcal/dia", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = OnMossGreenContainer))
                            }
                        }
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = ApricotContainer,
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("Classificação IMC", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                                Text(imcCategory, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = ApricotAccentDark))
                            }
                        }
                    }
                }
            }
        }

        // Daily Goals Settings Card
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth().testTag("goals_settings_card")
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Metas Nutricionais Diárias",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        )
                        IconButton(onClick = { showEditGoalsDialog = true }) {
                            Icon(Icons.Outlined.Tune, contentDescription = "Ajustar metas", tint = MossGreenPrimary)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Text("Calorias Diárias:", style = MaterialTheme.typography.bodyMedium)
                        Text("${goal.calorias} kcal", fontWeight = FontWeight.Bold, color = MossGreenPrimary)
                    }
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Text("Proteína:", style = MaterialTheme.typography.bodyMedium)
                        Text("${goal.proteinaG} g", fontWeight = FontWeight.Bold, color = MacroProteinColor)
                    }
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Text("Carboidratos:", style = MaterialTheme.typography.bodyMedium)
                        Text("${goal.carbsG} g", fontWeight = FontWeight.Bold, color = MacroCarbsColor)
                    }
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Text("Gorduras:", style = MaterialTheme.typography.bodyMedium)
                        Text("${goal.gorduraG} g", fontWeight = FontWeight.Bold, color = MacroFatColor)
                    }
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    ) {
                        Text("Meta de Água:", style = MaterialTheme.typography.bodyMedium)
                        Text("${goal.waterMl} ml", fontWeight = FontWeight.Bold, color = WaterBlue)
                    }
                }
            }
        }
    }

    // Edit Profile Dialog
    if (showEditProfileDialog) {
        var name by remember { mutableStateOf(userProfile.nome) }
        var weight by remember { mutableStateOf(userProfile.pesoKg.toString()) }
        var height by remember { mutableStateOf(userProfile.alturaCm.toString()) }
        var age by remember { mutableStateOf(userProfile.idade.toString()) }
        var objective by remember { mutableStateOf(userProfile.objetivo) }
        val objectives = listOf("Emagrecer", "Manter Peso", "Ganhar Massa")

        AlertDialog(
            onDismissRequest = { showEditProfileDialog = false },
            title = { Text("Editar Perfil & Dados Físicos", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Nome Completo") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = weight,
                            onValueChange = { weight = it },
                            label = { Text("Peso (kg)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = height,
                            onValueChange = { height = it },
                            label = { Text("Altura (cm)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    OutlinedTextField(
                        value = age,
                        onValueChange = { age = it },
                        label = { Text("Idade (anos)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text("Objetivo Atual:", fontWeight = FontWeight.SemiBold)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        objectives.forEach { obj ->
                            FilterChip(
                                selected = objective == obj,
                                onClick = { objective = obj },
                                label = { Text(obj, fontSize = 11.sp) }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val updated = userProfile.copy(
                            nome = name.ifBlank { userProfile.nome },
                            pesoKg = weight.toDoubleOrNull() ?: userProfile.pesoKg,
                            alturaCm = height.toDoubleOrNull() ?: userProfile.alturaCm,
                            idade = age.toIntOrNull() ?: userProfile.idade,
                            objetivo = objective
                        )
                        onUpdateProfile(updated)
                        showEditProfileDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary)
                ) {
                    Text("Salvar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditProfileDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    // Edit Goals Dialog
    if (showEditGoalsDialog) {
        var cal by remember { mutableStateOf(goal.calorias.toString()) }
        var prot by remember { mutableStateOf(goal.proteinaG.toString()) }
        var carbs by remember { mutableStateOf(goal.carbsG.toString()) }
        var fat by remember { mutableStateOf(goal.gorduraG.toString()) }
        var water by remember { mutableStateOf(goal.waterMl.toString()) }

        AlertDialog(
            onDismissRequest = { showEditGoalsDialog = false },
            title = { Text("Ajustar Metas Diárias", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = cal,
                        onValueChange = { cal = it },
                        label = { Text("Calorias Diárias (kcal)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = prot,
                            onValueChange = { prot = it },
                            label = { Text("Proteína (g)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = carbs,
                            onValueChange = { carbs = it },
                            label = { Text("Carbos (g)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = fat,
                            onValueChange = { fat = it },
                            label = { Text("Gordura (g)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = water,
                            onValueChange = { water = it },
                            label = { Text("Água (ml)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdateGoals(
                            cal.toIntOrNull() ?: goal.calorias,
                            carbs.toIntOrNull() ?: goal.carbsG,
                            prot.toIntOrNull() ?: goal.proteinaG,
                            fat.toIntOrNull() ?: goal.gorduraG,
                            water.toIntOrNull() ?: goal.waterMl
                        )
                        showEditGoalsDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary)
                ) {
                    Text("Atualizar Metas")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditGoalsDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}
