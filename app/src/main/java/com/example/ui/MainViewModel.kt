package com.example.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

enum class AppTab(val title: String) {
    DIARIO("Diário"),
    SCANNER("Scanner"),
    BUSCAR("Buscar"),
    CHAT("Social & IA"),
    PERFIL("Perfil")
}

data class MainUiState(
    val currentTab: AppTab = AppTab.DIARIO,
    val isScanning: Boolean = false,
    val scannedResult: ScannedFoodResult? = null,
    val isChatGenerating: Boolean = false,
    val searchQuery: String = "",
    val isPremiumModalOpen: Boolean = false,
    val userFeedbackMessage: String? = null
)

class MainViewModel(private val repository: NutritionRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    val todayEntries: StateFlow<List<FoodEntryEntity>> = repository.getEntriesForDate()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val dailyGoal: StateFlow<DailyGoalEntity?> = repository.getDailyGoal()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val todayWater: StateFlow<Int> = repository.getTodayWater()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val weeklyStats: StateFlow<List<WeeklyDayStat>> = repository.getWeeklyStats()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val chatMessages: StateFlow<List<ChatMessageEntity>> = repository.getChatMessages()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val userProfile: StateFlow<UserProfileEntity?> = repository.getUserProfile()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _searchQuery = MutableStateFlow("")
    val searchResults: StateFlow<List<FoodBasicEntity>> = _searchQuery
        .debounce(200)
        .flatMapLatest { query -> repository.searchFoods(query) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun setTab(tab: AppTab) {
        _uiState.update { it.copy(currentTab = tab) }
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun addWater(ml: Int) {
        viewModelScope.launch {
            repository.addWater(ml)
            showFeedback("+$ml ml de água registrados!")
        }
    }

    fun removeWater() {
        viewModelScope.launch {
            repository.removeLastWater()
            showFeedback("Registro de água desfeito")
        }
    }

    fun deleteFoodEntry(id: Long) {
        viewModelScope.launch {
            repository.deleteFoodEntry(id)
            showFeedback("Alimento removido do diário")
        }
    }

    fun addFoodToDiary(
        name: String,
        cal: Int,
        carbs: Double,
        prot: Double,
        fat: Double,
        portion: Double,
        mealType: String
    ) {
        viewModelScope.launch {
            repository.addFoodEntry(
                nome = name,
                calorias = cal,
                carbs = carbs,
                prot = prot,
                gord = fat,
                porcoes = portion,
                mealType = mealType
            )
            showFeedback("$name adicionado ao $mealType!")
        }
    }

    fun createCustomFood(
        name: String,
        cal: Int,
        carbs: Double,
        prot: Double,
        fat: Double,
        portion: String,
        category: String
    ) {
        viewModelScope.launch {
            repository.addCustomFood(name, cal, carbs, prot, fat, portion, category)
            showFeedback("Alimento customizado '$name' criado com sucesso!")
        }
    }

    fun performFoodScan(prompt: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isScanning = true, scannedResult = null) }
            val result = repository.analyzeFoodScan(prompt)
            _uiState.update { it.copy(isScanning = false, scannedResult = result) }
        }
    }

    fun saveScannedMeal(mealType: String, portionMultiplier: Double) {
        val result = _uiState.value.scannedResult ?: return
        viewModelScope.launch {
            repository.addFoodEntry(
                nome = result.title,
                calorias = result.totalCalories,
                carbs = result.totalCarbs,
                prot = result.totalProtein,
                gord = result.totalFat,
                porcoes = portionMultiplier,
                mealType = mealType
            )
            _uiState.update { it.copy(scannedResult = null, currentTab = AppTab.DIARIO) }
            showFeedback("Prato escaneado registrado no Diário!")
        }
    }

    fun clearScannedResult() {
        _uiState.update { it.copy(scannedResult = null) }
    }

    fun sendChatMessage(text: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isChatGenerating = true) }
            repository.sendChatMessage(text)
            _uiState.update { it.copy(isChatGenerating = false) }
        }
    }

    fun clearChat() {
        viewModelScope.launch {
            repository.clearChat()
            showFeedback("Histórico de conversa reiniciado")
        }
    }

    fun updateGoals(cal: Int, carbs: Int, prot: Int, fat: Int, water: Int) {
        viewModelScope.launch {
            repository.updateGoals(cal, carbs, prot, fat, water)
            showFeedback("Metas diárias atualizadas com sucesso!")
        }
    }

    fun updateProfile(profile: UserProfileEntity) {
        viewModelScope.launch {
            repository.updateProfile(profile)
            showFeedback("Perfil atualizado!")
        }
    }

    fun openPremiumModal() {
        _uiState.update { it.copy(isPremiumModalOpen = true) }
    }

    fun closePremiumModal() {
        _uiState.update { it.copy(isPremiumModalOpen = false) }
    }

    fun subscribePremium(plan: String) {
        viewModelScope.launch {
            val current = userProfile.value ?: UserProfileEntity()
            repository.updateProfile(current.copy(isPremium = true))
            _uiState.update { it.copy(isPremiumModalOpen = false) }
            showFeedback("Parabéns! Você agora é Sar.scan Premium!")
        }
    }

    fun clearFeedback() {
        _uiState.update { it.copy(userFeedbackMessage = null) }
    }

    private fun showFeedback(msg: String) {
        _uiState.update { it.copy(userFeedbackMessage = msg) }
    }

    class Factory(private val repository: NutritionRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return MainViewModel(repository) as T
        }
    }
}
