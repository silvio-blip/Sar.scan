package com.aistudio.sarscan.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "food_entries")
data class FoodEntry(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val calories: Double,
    val carbs: Double,
    val protein: Double,
    val fat: Double,
    val portion: String = "100g",
    val date: String, // Format: YYYY-MM-DD
    val mealType: String = "Almoço", // Café da Manhã, Almoço, Jantar, Lanche
    val timestamp: Long = System.currentTimeMillis()
)
