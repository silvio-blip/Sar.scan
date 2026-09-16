package com.aistudio.sarscan.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aistudio.sarscan.data.model.FoodCatalogItem
import com.aistudio.sarscan.ui.theme.AlmondSecondary
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
fun BuscarScreen(
    viewModel: NutritionViewModel,
    modifier: Modifier = Modifier
) {
    val searchQuery by viewModel.searchQuery.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val filteredFoods by viewModel.filteredFoods.collectAsState()

    var selectedItemForPortion by remember { mutableStateOf<FoodCatalogItem?>(null) }

    val categories = listOf("Todos", "Proteínas", "Carboidratos", "Frutas", "Laticínios", "Gorduras Saudáveis")

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(LinenBackground)
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(modifier = Modifier.height(16.dp))
        Column {
            Text(
                text = "Catálogo Nutricional",
                style = MaterialTheme.typography.headlineLarge.copy(
                    color = MossPrimaryDark,
                    fontWeight = FontWeight.ExtraBold
                )
            )
            Text(
                text = "Tabela TACO brasileira e alimentos comuns",
                style = MaterialTheme.typography.bodyMedium
            )
        }

        // Search Input Field
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { viewModel.onSearchQueryChanged(it) },
            modifier = Modifier
                .fillMaxWidth()
                .testTag("search_food_input"),
            placeholder = { Text("Buscar por nome (ex: frango, tapioca, banana)...") },
            leadingIcon = {
                Icon(imageVector = Icons.Default.Search, contentDescription = "Buscar", tint = MossPrimary)
            },
            shape = RoundedCornerShape(16.dp),
            singleLine = true
        )

        // Category Filter Chips
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            categories.forEach { cat ->
                val isSelected = selectedCategory == cat
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (isSelected) MossPrimary else CardWhite)
                        .clickable { viewModel.onCategorySelected(cat) }
                        .padding(horizontal = 14.dp, vertical = 8.dp)
                        .testTag("filter_chip_$cat")
                ) {
                    Text(
                        text = cat,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = if (isSelected) CardWhite else CharcoalText
                        )
                    )
                }
            }
        }

        // Food Items List
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(filteredFoods, key = { it.id }) { item ->
                FoodCatalogCard(
                    item = item,
                    onClick = { selectedItemForPortion = item }
                )
            }
            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    // Portion adjustment dialog
    selectedItemForPortion?.let { item ->
        PortionCustomizerDialog(
            item = item,
            onDismiss = { selectedItemForPortion = null },
            onConfirm = { grams, mealType ->
                viewModel.addCatalogFood(item, grams, mealType)
                selectedItemForPortion = null
            }
        )
    }
}

@Composable
fun FoodCatalogCard(
    item: FoodCatalogItem,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .testTag("catalog_card_${item.id}"),
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
                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                )
                Text(
                    text = "${item.category} • por 100g",
                    style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "C: ${item.carbsPer100g.toInt()}g",
                        style = MaterialTheme.typography.labelSmall.copy(color = CarbsColor, fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = "P: ${item.proteinPer100g.toInt()}g",
                        style = MaterialTheme.typography.labelSmall.copy(color = ProteinColor, fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = "G: ${item.fatPer100g.toInt()}g",
                        style = MaterialTheme.typography.labelSmall.copy(color = FatColor, fontWeight = FontWeight.Bold)
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${item.caloriesPer100g.toInt()} kcal",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MossPrimary
                    )
                )
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(AlmondSecondary)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Adicionar",
                        tint = MossPrimary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun PortionCustomizerDialog(
    item: FoodCatalogItem,
    onDismiss: () -> Unit,
    onConfirm: (grams: Double, mealType: String) -> Unit
) {
    var grams by remember { mutableDoubleStateOf(item.defaultPortionGrams) }
    var selectedMeal by remember { mutableStateOf("Almoço") }

    val calculated = item.calculateForGrams(grams)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = item.name,
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(
                    text = "Ajuste a porção consumida:",
                    style = MaterialTheme.typography.bodyMedium
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Peso:", style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "${grams.toInt()}g",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = MossPrimary
                        )
                    )
                }

                Slider(
                    value = grams.toFloat(),
                    onValueChange = { grams = (it / 10).toInt() * 10.0 },
                    valueRange = 10f..500f,
                    steps = 48,
                    colors = SliderDefaults.colors(
                        thumbColor = MossPrimary,
                        activeTrackColor = MossPrimary
                    )
                )

                // Computed macros card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = AlmondSecondary)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "Calorias", style = MaterialTheme.typography.labelSmall)
                            Text(
                                text = "${calculated.calories.toInt()} kcal",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "Carbos", style = MaterialTheme.typography.labelSmall, color = CarbsColor)
                            Text(
                                text = "${calculated.carbs.toInt()}g",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "Proteína", style = MaterialTheme.typography.labelSmall, color = ProteinColor)
                            Text(
                                text = "${calculated.protein.toInt()}g",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                    }
                }

                // Meal selector
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf("Café", "Almoço", "Jantar", "Lanche").forEach { m ->
                        val active = selectedMeal.startsWith(m)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (active) MossPrimary else CardWhite)
                                .clickable { selectedMeal = m }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = m,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = if (active) CardWhite else CharcoalText
                                )
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(grams, selectedMeal) },
                colors = ButtonDefaults.buttonColors(containerColor = MossPrimary)
            ) {
                Icon(imageVector = Icons.Default.Check, contentDescription = null)
                Spacer(modifier = Modifier.size(6.dp))
                Text("Adicionar ao Diário")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}
