package com.example.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "food_entries")
data class FoodEntryEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val nome: String,
    val calorias: Int,
    val carbs: Double,
    val prot: Double,
    val gord: Double,
    val porcoes: Double = 1.0,
    val data: String, // YYYY-MM-DD
    val fotoUrl: String? = null,
    val mealType: String = "Almoço", // Café da Manhã, Almoço, Jantar, Lanches
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "daily_goals")
data class DailyGoalEntity(
    @PrimaryKey
    val id: Long = 1,
    val calorias: Int = 2000,
    val carbsG: Int = 220,
    val proteinaG: Int = 140,
    val gorduraG: Int = 60,
    val waterMl: Int = 2500,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "water_intake")
data class WaterIntakeEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val data: String, // YYYY-MM-DD
    val ml: Int,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "foods_basic")
data class FoodBasicEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val nome: String,
    val cal: Int,
    val carb: Double,
    val prot: Double,
    val gord: Double,
    val porcao: String = "100g",
    val categoria: String = "Geral",
    val fotoUrl: String? = null
)

@Entity(tableName = "chat_messages")
data class ChatMessageEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val role: String, // "user" or "assistant"
    val content: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "user_profile")
data class UserProfileEntity(
    @PrimaryKey
    val id: Long = 1,
    val nome: String = "Usuário Sar.scan",
    val email: String = "usuario@sarscan.com",
    val pesoKg: Double = 72.5,
    val alturaCm: Double = 175.0,
    val idade: Int = 28,
    val genero: String = "Masculino", // Masculino / Feminino
    val nivelAtividade: String = "Moderadamente Ativo", // Sedentário, Leve, Moderado, Intenso
    val objetivo: String = "Emagrecer", // Emagrecer, Manter Peso, Ganhar Massa
    val streakDays: Int = 5,
    val isPremium: Boolean = false
)
