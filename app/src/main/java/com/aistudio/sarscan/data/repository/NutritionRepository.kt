package com.aistudio.sarscan.data.repository

import android.content.Context
import com.aistudio.sarscan.api.GeminiClient
import com.aistudio.sarscan.api.ScannedFoodAnalysis
import com.aistudio.sarscan.data.db.SarScanDatabase
import com.aistudio.sarscan.data.model.ChatMessage
import com.aistudio.sarscan.data.model.FoodCatalogItem
import com.aistudio.sarscan.data.model.FoodEntry
import com.aistudio.sarscan.data.model.UserProfile
import com.aistudio.sarscan.data.model.WaterEntry
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.LocalDate

class NutritionRepository(
    private val context: Context,
    private val database: SarScanDatabase
) {
    private val foodDao = database.foodEntryDao()
    private val waterDao = database.waterEntryDao()
    private val chatDao = database.chatMessageDao()
    val geminiClient = GeminiClient()

    private val prefs = context.getSharedPreferences("sarscan_prefs", Context.MODE_PRIVATE)

    private val _userProfile = MutableStateFlow(loadUserProfile())
    val userProfile = _userProfile.asStateFlow()

    fun getTodayDate(): String = LocalDate.now().toString()

    // Food entries
    fun getTodayFoodEntries(): Flow<List<FoodEntry>> = foodDao.getEntriesForDate(getTodayDate())
    fun getTodayTotalCalories(): Flow<Double?> = foodDao.getTotalCaloriesForDate(getTodayDate())
    fun getTodayTotalProtein(): Flow<Double?> = foodDao.getTotalProteinForDate(getTodayDate())
    fun getTodayTotalCarbs(): Flow<Double?> = foodDao.getTotalCarbsForDate(getTodayDate())
    fun getTodayTotalFat(): Flow<Double?> = foodDao.getTotalFatForDate(getTodayDate())

    suspend fun addFoodEntry(entry: FoodEntry): Long {
        val id = foodDao.insertEntry(entry)
        updateScanStats()
        return id
    }

    suspend fun addFoodEntries(entries: List<FoodEntry>) {
        foodDao.insertEntries(entries)
        updateScanStats()
    }

    suspend fun deleteFoodEntry(entry: FoodEntry) {
        foodDao.deleteEntry(entry)
    }

    // Water entries
    fun getTodayWaterEntries(): Flow<List<WaterEntry>> = waterDao.getWaterEntriesForDate(getTodayDate())
    fun getTodayTotalWater(): Flow<Int?> = waterDao.getTotalWaterForDate(getTodayDate())

    suspend fun addWater(amountMl: Int) {
        waterDao.insertWaterEntry(
            WaterEntry(
                amountMl = amountMl,
                date = getTodayDate()
            )
        )
    }

    suspend fun removeLatestWater() {
        waterDao.deleteLatestForDate(getTodayDate())
    }

    // Chat
    fun getChatMessages(): Flow<List<ChatMessage>> = chatDao.getAllMessages()

    suspend fun sendChatMessage(userText: String): String {
        chatDao.insertMessage(
            ChatMessage(
                sender = "user",
                content = userText
            )
        )

        val result = geminiClient.chatNutritionist(userText, "")
        val reply = result.getOrDefault("Obrigado pela sua mensagem! Mantenha o foco em seus objetivos.")

        chatDao.insertMessage(
            ChatMessage(
                sender = "assistant",
                content = reply
            )
        )
        return reply
    }

    suspend fun clearChatHistory() {
        chatDao.clearHistory()
    }

    // AI Food Scanner
    suspend fun scanFoodImage(base64Image: String): Result<ScannedFoodAnalysis> {
        return geminiClient.analyzeFoodImage(base64Image)
    }

    // Pre-loaded food catalog
    fun getFoodCatalog(): List<FoodCatalogItem> = foodCatalog

    fun searchFoodCatalog(query: String, categoryFilter: String = "Todos"): List<FoodCatalogItem> {
        return foodCatalog.filter { item ->
            val matchesQuery = query.isBlank() || item.name.contains(query, ignoreCase = true)
            val matchesCategory = categoryFilter == "Todos" || item.category.equals(categoryFilter, ignoreCase = true)
            matchesQuery && matchesCategory
        }
    }

    // Profile & goals
    fun updateUserProfile(profile: UserProfile) {
        prefs.edit().apply {
            putString("name", profile.name)
            putFloat("weightKg", profile.weightKg)
            putFloat("heightCm", profile.heightCm)
            putInt("age", profile.age)
            putString("goal", profile.goal)
            putInt("targetCalories", profile.targetCalories)
            putInt("targetWaterMl", profile.targetWaterMl)
            putInt("targetProteinG", profile.targetProteinG)
            putInt("targetCarbsG", profile.targetCarbsG)
            putInt("targetFatG", profile.targetFatG)
            apply()
        }
        _userProfile.value = profile
    }

    private fun loadUserProfile(): UserProfile {
        return try {
            UserProfile(
                name = prefs.getString("name", "Usuário") ?: "Usuário",
                weightKg = prefs.getFloat("weightKg", 72.0f),
                heightCm = prefs.getFloat("heightCm", 175.0f),
                age = prefs.getInt("age", 28),
                goal = prefs.getString("goal", "Perder peso") ?: "Perder peso",
                targetCalories = prefs.getInt("targetCalories", 2000),
                targetWaterMl = prefs.getInt("targetWaterMl", 2500),
                targetProteinG = prefs.getInt("targetProteinG", 140),
                targetCarbsG = prefs.getInt("targetCarbsG", 210),
                targetFatG = prefs.getInt("targetFatG", 60),
                streakDays = prefs.getInt("streakDays", 4),
                totalScans = prefs.getInt("totalScans", 18)
            )
        } catch (e: Exception) {
            UserProfile()
        }
    }

    private fun updateScanStats() {
        val currentScans = _userProfile.value.totalScans + 1
        prefs.edit().putInt("totalScans", currentScans).apply()
        _userProfile.value = _userProfile.value.copy(totalScans = currentScans)
    }

    companion object {
        val foodCatalog = listOf(
            FoodCatalogItem("1", "Peito de Frango Grelhado", "Proteínas", 165.0, 0.0, 31.0, 3.6, 100.0),
            FoodCatalogItem("2", "Arroz Branco Cozido", "Carboidratos", 130.0, 28.2, 2.7, 0.3, 100.0),
            FoodCatalogItem("3", "Feijão Carioca Cozido", "Carboidratos", 76.0, 13.6, 4.8, 0.5, 100.0),
            FoodCatalogItem("4", "Ovo Cozido Inteiro", "Proteínas", 155.0, 1.1, 13.0, 11.0, 50.0),
            FoodCatalogItem("5", "Carne Moída Patinho", "Proteínas", 219.0, 0.0, 35.9, 7.3, 100.0),
            FoodCatalogItem("6", "Batata Doce Cozida", "Carboidratos", 86.0, 20.1, 1.6, 0.1, 100.0),
            FoodCatalogItem("7", "Aveia em Flocos", "Carboidratos", 389.0, 66.3, 16.9, 6.9, 40.0),
            FoodCatalogItem("8", "Banana Prata", "Frutas", 89.0, 22.8, 1.1, 0.3, 100.0),
            FoodCatalogItem("9", "Maçã Gala", "Frutas", 52.0, 13.8, 0.3, 0.2, 130.0),
            FoodCatalogItem("10", "Pão Francês", "Carboidratos", 300.0, 58.7, 8.0, 3.1, 50.0),
            FoodCatalogItem("11", "Tapioca Pronta", "Carboidratos", 240.0, 60.0, 0.0, 0.0, 80.0),
            FoodCatalogItem("12", "Whey Protein Concentrado", "Proteínas", 400.0, 8.0, 80.0, 6.0, 30.0),
            FoodCatalogItem("13", "Queijo Minas Frescal", "Laticínios", 264.0, 3.2, 17.4, 20.2, 50.0),
            FoodCatalogItem("14", "Iogurte Natural Desnatado", "Laticínios", 43.0, 6.0, 4.1, 0.3, 170.0),
            FoodCatalogItem("15", "Azeite de Oliva Extra Virgem", "Gorduras Saudáveis", 884.0, 0.0, 0.0, 100.0, 10.0),
            FoodCatalogItem("16", "Castanha-do-Pará", "Gorduras Saudáveis", 656.0, 12.3, 14.3, 66.4, 20.0),
            FoodCatalogItem("17", "Salmão Grelhado", "Proteínas", 206.0, 0.0, 22.1, 12.3, 120.0),
            FoodCatalogItem("18", "Salada Verde Mista", "Vegetais", 15.0, 2.9, 1.4, 0.2, 100.0)
        )
    }
}
