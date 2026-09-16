package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.FoodBasicEntity
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BuscarScreen(
    foods: List<FoodBasicEntity>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onAddFoodToDiary: (name: String, cal: Int, carbs: Double, prot: Double, fat: Double, portion: Double, mealType: String) -> Unit,
    onCreateCustomFood: (name: String, cal: Int, carbs: Double, prot: Double, fat: Double, portion: String, category: String) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedCategory by remember { mutableStateOf("Todos") }
    var selectedFoodForAdd by remember { mutableStateOf<FoodBasicEntity?>(null) }
    var showCreateDialog by remember { mutableStateOf(false) }

    val categories = listOf(
        "Todos",
        "Proteínas",
        "Carboidratos",
        "Frutas",
        "Leguminosas",
        "Laticínios",
        "Suplementos",
        "Gorduras",
        "Vegetais"
    )

    val filteredFoods = remember(foods, selectedCategory) {
        if (selectedCategory == "Todos") {
            foods
        } else {
            foods.filter { it.categoria.equals(selectedCategory, ignoreCase = true) }
        }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = MossGreenPrimary,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .padding(bottom = 70.dp)
                    .testTag("create_custom_food_fab")
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 16.dp)
                ) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Criar Alimento", fontWeight = FontWeight.Bold)
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
        modifier = modifier.fillMaxSize()
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                placeholder = { Text("Buscar frango, arroz, aveia, whey...") },
                leadingIcon = {
                    Icon(Icons.Filled.Search, contentDescription = null, tint = MossGreenPrimary)
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchQueryChange("") }) {
                            Icon(Icons.Filled.Clear, contentDescription = "Limpar busca")
                        }
                    }
                },
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MossGreenPrimary,
                    unfocusedBorderColor = BorderSubtle,
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface
                ),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("search_food_input")
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Categories Filter Chips
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(categories) { category ->
                    FilterChip(
                        selected = selectedCategory == category,
                        onClick = { selectedCategory = category },
                        label = { Text(category, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MossGreenContainer,
                            selectedLabelColor = OnMossGreenContainer
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Food List
            if (filteredFoods.isEmpty()) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize().padding(bottom = 80.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Outlined.SearchOff,
                            contentDescription = null,
                            tint = TextSecondary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Nenhum alimento encontrado",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = TextPrimary)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Toque em 'Criar Alimento' para adicionar com macros personalizados.",
                            style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 120.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(filteredFoods, key = { it.id }) { food ->
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedFoodForAdd = food }
                                .testTag("food_item_${food.id}")
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(MossGreenContainer),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.Eco,
                                        contentDescription = null,
                                        tint = MossGreenPrimary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = food.nome,
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.SemiBold,
                                            color = TextPrimary
                                        )
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "Porção: ${food.porcao} • ${food.categoria}",
                                        style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary)
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text(
                                            text = "P: ${food.prot}g",
                                            style = MaterialTheme.typography.labelSmall.copy(color = MacroProteinColor, fontWeight = FontWeight.Bold)
                                        )
                                        Text(
                                            text = "C: ${food.carb}g",
                                            style = MaterialTheme.typography.labelSmall.copy(color = MacroCarbsColor, fontWeight = FontWeight.Bold)
                                        )
                                        Text(
                                            text = "G: ${food.gord}g",
                                            style = MaterialTheme.typography.labelSmall.copy(color = MacroFatColor, fontWeight = FontWeight.Bold)
                                        )
                                    }
                                }

                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = MossGreenContainer,
                                    modifier = Modifier.padding(start = 8.dp)
                                ) {
                                    Text(
                                        text = "${food.cal} kcal",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = OnMossGreenContainer
                                        ),
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Add Food Dialog (Portion Adjuster & Meal Type)
    selectedFoodForAdd?.let { food ->
        var portionCount by remember { mutableStateOf(1.0) }
        var mealType by remember { mutableStateOf("Almoço") }
        val mealTypes = listOf("Café da Manhã", "Almoço", "Jantar", "Lanches")

        AlertDialog(
            onDismissRequest = { selectedFoodForAdd = null },
            title = {
                Text(
                    text = food.nome,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(
                        text = "Porção base: ${food.porcao} (${food.cal} kcal)",
                        style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary)
                    )

                    // Multiplier controls
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Quantidade:", fontWeight = FontWeight.SemiBold)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(
                                onClick = { if (portionCount > 0.5) portionCount -= 0.5 },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(Icons.Filled.RemoveCircleOutline, contentDescription = "Diminuir")
                            }
                            Text(
                                text = "${String.format(java.util.Locale.US, "%.1f", portionCount)}x",
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp)
                            )
                            IconButton(
                                onClick = { portionCount += 0.5 },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(Icons.Filled.AddCircleOutline, contentDescription = "Aumentar")
                            }
                        }
                    }

                    // Total calculated for this portion
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MossGreenContainer,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Text("Total:", fontWeight = FontWeight.Bold, color = OnMossGreenContainer)
                            Text(
                                text = "${(food.cal * portionCount).toInt()} kcal • P: ${(food.prot * portionCount).toInt()}g • C: ${(food.carb * portionCount).toInt()}g",
                                fontWeight = FontWeight.Bold,
                                color = OnMossGreenContainer
                            )
                        }
                    }

                    // Meal Type
                    Text("Refeição:", fontWeight = FontWeight.SemiBold)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        mealTypes.forEach { type ->
                            FilterChip(
                                selected = mealType == type,
                                onClick = { mealType = type },
                                label = { Text(type, fontSize = 10.sp) }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onAddFoodToDiary(
                            food.nome,
                            food.cal,
                            food.carb,
                            food.prot,
                            food.gord,
                            portionCount,
                            mealType
                        )
                        selectedFoodForAdd = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary),
                    modifier = Modifier.testTag("confirm_add_food_button")
                ) {
                    Text("Adicionar ao Diário")
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedFoodForAdd = null }) {
                    Text("Cancelar")
                }
            }
        )
    }

    // Create Custom Food Dialog
    if (showCreateDialog) {
        var name by remember { mutableStateOf("") }
        var cal by remember { mutableStateOf("") }
        var prot by remember { mutableStateOf("") }
        var carbs by remember { mutableStateOf("") }
        var fat by remember { mutableStateOf("") }
        var portion by remember { mutableStateOf("100g") }
        var category by remember { mutableStateOf("Geral") }

        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = {
                Text(
                    text = "Criar Alimento Personalizado",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                )
            },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Nome do alimento") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = cal,
                            onValueChange = { cal = it },
                            label = { Text("Calorias (kcal)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = portion,
                            onValueChange = { portion = it },
                            label = { Text("Porção (ex: 100g)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = prot,
                            onValueChange = { prot = it },
                            label = { Text("Proteína (g)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = carbs,
                            onValueChange = { carbs = it },
                            label = { Text("Carbos (g)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = fat,
                            onValueChange = { fat = it },
                            label = { Text("Gordura (g)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (name.isNotBlank() && cal.isNotBlank()) {
                            onCreateCustomFood(
                                name.trim(),
                                cal.toIntOrNull() ?: 0,
                                carbs.toDoubleOrNull() ?: 0.0,
                                prot.toDoubleOrNull() ?: 0.0,
                                fat.toDoubleOrNull() ?: 0.0,
                                portion.ifBlank { "100g" },
                                category
                            )
                            showCreateDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary)
                ) {
                    Text("Salvar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}
