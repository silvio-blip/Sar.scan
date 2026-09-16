package com.aistudio.sarscan.data.model

import kotlinx.serialization.Serializable

@Serializable
data class FoodCatalogItem(
    val id: String,
    val name: String,
    val category: String, // "Proteínas", "Carboidratos", "Frutas", "Laticínios", "Gorduras Saudáveis"
    val caloriesPer100g: Double,
    val carbsPer100g: Double,
    val proteinPer100g: Double,
    val fatPer100g: Double,
    val defaultPortionGrams: Double = 100.0,
    val portionUnitLabel: String = "g"
) {
    fun calculateForGrams(grams: Double): FoodEntry {
        val factor = grams / 100.0
        return FoodEntry(
            name = name,
            calories = (caloriesPer100g * factor * 10).toInt() / 10.0,
            carbs = (carbsPer100g * factor * 10).toInt() / 10.0,
            protein = (proteinPer100g * factor * 10).toInt() / 10.0,
            fat = (fatPer100g * factor * 10).toInt() / 10.0,
            portion = "${grams.toInt()}g",
            date = java.time.LocalDate.now().toString()
        )
    }
}
