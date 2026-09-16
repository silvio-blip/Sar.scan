package com.aistudio.sarscan.viewmodel

import android.graphics.Bitmap
import android.util.Base64
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudio.sarscan.api.ScannedFoodAnalysis
import com.aistudio.sarscan.api.ScannedItemDetail
import com.aistudio.sarscan.data.model.ChatMessage
import com.aistudio.sarscan.data.model.FoodCatalogItem
import com.aistudio.sarscan.data.model.FoodEntry
import com.aistudio.sarscan.data.model.UserProfile
import com.aistudio.sarscan.data.model.WaterEntry
import com.aistudio.sarscan.data.repository.NutritionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream

sealed interface ScannerUiState {
    data object Idle : ScannerUiState
    data object Scanning : ScannerUiState
    data class Success(val analysis: ScannedFoodAnalysis, val selectedItems: Set<Int>) : ScannerUiState
    data class Error(val message: String) : ScannerUiState
}

class NutritionViewModel(
    private val repository: NutritionRepository
) : ViewModel() {

    // Food & Macros State
    val todayEntries: StateFlow<List<FoodEntry>> = repository.getTodayFoodEntries()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val todayCalories: StateFlow<Double?> = repository.getTodayTotalCalories()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val todayProtein: StateFlow<Double?> = repository.getTodayTotalProtein()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val todayCarbs: StateFlow<Double?> = repository.getTodayTotalCarbs()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val todayFat: StateFlow<Double?> = repository.getTodayTotalFat()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    // Water State
    val todayWaterTotal: StateFlow<Int?> = repository.getTodayTotalWater()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val todayWaterEntries: StateFlow<List<WaterEntry>> = repository.getTodayWaterEntries()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Profile State
    val userProfile: StateFlow<UserProfile> = repository.userProfile

    // Chat State
    val chatMessages: StateFlow<List<ChatMessage>> = repository.getChatMessages()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _isChatLoading = MutableStateFlow(false)
    val isChatLoading: StateFlow<Boolean> = _isChatLoading.asStateFlow()

    // Scanner State
    private val _scannerState = MutableStateFlow<ScannerUiState>(ScannerUiState.Idle)
    val scannerState: StateFlow<ScannerUiState> = _scannerState.asStateFlow()

    // Search Catalog State
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedCategory = MutableStateFlow("Todos")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()

    private val _filteredFoods = MutableStateFlow(repository.getFoodCatalog())
    val filteredFoods: StateFlow<List<FoodCatalogItem>> = _filteredFoods.asStateFlow()

    // Actions
    fun addWater(amountMl: Int) {
        viewModelScope.launch {
            repository.addWater(amountMl)
        }
    }

    fun removeLatestWater() {
        viewModelScope.launch {
            repository.removeLatestWater()
        }
    }

    fun deleteFood(entry: FoodEntry) {
        viewModelScope.launch {
            repository.deleteFoodEntry(entry)
        }
    }

    fun addManualFood(name: String, calories: Double, carbs: Double, protein: Double, fat: Double, portion: String, mealType: String) {
        viewModelScope.launch {
            val entry = FoodEntry(
                name = name,
                calories = calories,
                carbs = carbs,
                protein = protein,
                fat = fat,
                portion = portion,
                date = repository.getTodayDate(),
                mealType = mealType
            )
            repository.addFoodEntry(entry)
        }
    }

    fun addCatalogFood(item: FoodCatalogItem, grams: Double, mealType: String = "Almoço") {
        viewModelScope.launch {
            val entry = item.calculateForGrams(grams).copy(
                date = repository.getTodayDate(),
                mealType = mealType
            )
            repository.addFoodEntry(entry)
        }
    }

    fun onSearchQueryChanged(newQuery: String) {
        _searchQuery.value = newQuery
        _filteredFoods.value = repository.searchFoodCatalog(newQuery, _selectedCategory.value)
    }

    fun onCategorySelected(category: String) {
        _selectedCategory.value = category
        _filteredFoods.value = repository.searchFoodCatalog(_searchQuery.value, category)
    }

    fun sendChatMessage(text: String) {
        if (text.isBlank()) return
        viewModelScope.launch {
            _isChatLoading.value = true
            try {
                repository.sendChatMessage(text)
            } finally {
                _isChatLoading.value = false
            }
        }
    }

    fun scanBitmap(bitmap: Bitmap) {
        viewModelScope.launch {
            _scannerState.value = ScannerUiState.Scanning
            try {
                val outputStream = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
                val base64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
                val result = repository.scanFoodImage(base64)
                result.onSuccess { analysis ->
                    val allIndices = analysis.items.indices.toSet()
                    _scannerState.value = ScannerUiState.Success(analysis, allIndices)
                }.onFailure { error ->
                    _scannerState.value = ScannerUiState.Error(error.localizedMessage ?: "Erro ao analisar alimento")
                }
            } catch (e: Exception) {
                _scannerState.value = ScannerUiState.Error(e.localizedMessage ?: "Erro inesperado")
            }
        }
    }

    fun toggleItemSelection(index: Int) {
        val current = _scannerState.value
        if (current is ScannerUiState.Success) {
            val updated = if (current.selectedItems.contains(index)) {
                current.selectedItems - index
            } else {
                current.selectedItems + index
            }
            _scannerState.value = current.copy(selectedItems = updated)
        }
    }

    fun confirmScannedFoods(mealType: String = "Almoço") {
        val current = _scannerState.value
        if (current is ScannerUiState.Success) {
            viewModelScope.launch {
                val entries = current.analysis.items
                    .filterIndexed { index, _ -> current.selectedItems.contains(index) }
                    .map { item ->
                        FoodEntry(
                            name = item.name,
                            calories = item.calories,
                            carbs = item.carbs,
                            protein = item.protein,
                            fat = item.fat,
                            portion = item.portion,
                            date = repository.getTodayDate(),
                            mealType = mealType
                        )
                    }
                if (entries.isNotEmpty()) {
                    repository.addFoodEntries(entries)
                } else {
                    // Fallback to main meal if no sub-items selected
                    repository.addFoodEntry(
                        FoodEntry(
                            name = current.analysis.mealName,
                            calories = current.analysis.estimatedCalories,
                            carbs = current.analysis.carbsGrams,
                            protein = current.analysis.proteinGrams,
                            fat = current.analysis.fatGrams,
                            portion = current.analysis.portionDescription,
                            date = repository.getTodayDate(),
                            mealType = mealType
                        )
                    )
                }
                _scannerState.value = ScannerUiState.Idle
            }
        }
    }

    fun dismissScanner() {
        _scannerState.value = ScannerUiState.Idle
    }

    fun updateProfile(profile: UserProfile) {
        repository.updateUserProfile(profile)
    }

    class Factory(private val repository: NutritionRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return NutritionViewModel(repository) as T
        }
    }
}
