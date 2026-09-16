package com.aistudio.sarscan.data.model

import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val name: String = "Usuário",
    val weightKg: Float = 72.0f,
    val heightCm: Float = 175.0f,
    val age: Int = 28,
    val goal: String = "Perder peso", // "Perder peso", "Manter peso", "Ganhar massa"
    val targetCalories: Int = 2000,
    val targetWaterMl: Int = 2500,
    val targetProteinG: Int = 140,
    val targetCarbsG: Int = 210,
    val targetFatG: Int = 60,
    val streakDays: Int = 4,
    val totalScans: Int = 18
)
