package com.example.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.screens.*
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(viewModel: MainViewModel) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val todayEntries by viewModel.todayEntries.collectAsStateWithLifecycle()
    val dailyGoal by viewModel.dailyGoal.collectAsStateWithLifecycle()
    val todayWater by viewModel.todayWater.collectAsStateWithLifecycle()
    val weeklyStats by viewModel.weeklyStats.collectAsStateWithLifecycle()
    val searchResults by viewModel.searchResults.collectAsStateWithLifecycle()
    val chatMessages by viewModel.chatMessages.collectAsStateWithLifecycle()
    val userProfile by viewModel.userProfile.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.userFeedbackMessage) {
        uiState.userFeedbackMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearFeedback()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(start = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(MossGreenPrimary),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Eco,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Sar.scan",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary,
                                    letterSpacing = (-0.5).sp
                                )
                            )
                            Text(
                                text = "Nutrição Inteligente & IA",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = TextSecondary,
                                    fontSize = 10.sp
                                )
                            )
                        }
                    }
                },
                actions = {
                    // Streak Pill
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = ApricotContainer,
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.LocalFireDepartment,
                                contentDescription = "Ofensiva",
                                tint = ApricotAccent,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${userProfile?.streakDays ?: 5}d",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = ApricotAccentDark
                                )
                            )
                        }
                    }

                    // Premium button
                    IconButton(
                        onClick = { viewModel.openPremiumModal() },
                        modifier = Modifier.padding(end = 6.dp).testTag("top_bar_premium_button")
                    ) {
                        Icon(
                            imageVector = Icons.Filled.WorkspacePremium,
                            contentDescription = "Premium",
                            tint = ApricotAccent
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp,
                modifier = Modifier.testTag("bottom_navigation_bar")
            ) {
                // Diário Tab
                NavigationBarItem(
                    selected = uiState.currentTab == AppTab.DIARIO,
                    onClick = { viewModel.setTab(AppTab.DIARIO) },
                    icon = {
                        Icon(
                            imageVector = if (uiState.currentTab == AppTab.DIARIO) Icons.Filled.History else Icons.Outlined.History,
                            contentDescription = "Diário"
                        )
                    },
                    label = { Text("Diário") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MossGreenPrimary,
                        selectedTextColor = MossGreenPrimary,
                        indicatorColor = MossGreenContainer
                    ),
                    modifier = Modifier.testTag("nav_tab_diario")
                )

                // Scanner Tab (Camera / AI vision)
                NavigationBarItem(
                    selected = uiState.currentTab == AppTab.SCANNER,
                    onClick = { viewModel.setTab(AppTab.SCANNER) },
                    icon = {
                        Icon(
                            imageVector = if (uiState.currentTab == AppTab.SCANNER) Icons.Filled.CameraAlt else Icons.Outlined.CameraAlt,
                            contentDescription = "Scanner"
                        )
                    },
                    label = { Text("Scanner") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MossGreenPrimary,
                        selectedTextColor = MossGreenPrimary,
                        indicatorColor = MossGreenContainer
                    ),
                    modifier = Modifier.testTag("nav_tab_scanner")
                )

                // Buscar Tab
                NavigationBarItem(
                    selected = uiState.currentTab == AppTab.BUSCAR,
                    onClick = { viewModel.setTab(AppTab.BUSCAR) },
                    icon = {
                        Icon(
                            imageVector = if (uiState.currentTab == AppTab.BUSCAR) Icons.Filled.Search else Icons.Outlined.Search,
                            contentDescription = "Buscar"
                        )
                    },
                    label = { Text("Buscar") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MossGreenPrimary,
                        selectedTextColor = MossGreenPrimary,
                        indicatorColor = MossGreenContainer
                    ),
                    modifier = Modifier.testTag("nav_tab_buscar")
                )

                // Chat / IA Tab
                NavigationBarItem(
                    selected = uiState.currentTab == AppTab.CHAT,
                    onClick = { viewModel.setTab(AppTab.CHAT) },
                    icon = {
                        Icon(
                            imageVector = if (uiState.currentTab == AppTab.CHAT) Icons.Filled.AutoAwesome else Icons.Outlined.AutoAwesome,
                            contentDescription = "Social & IA"
                        )
                    },
                    label = { Text("Nutri IA") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MossGreenPrimary,
                        selectedTextColor = MossGreenPrimary,
                        indicatorColor = MossGreenContainer
                    ),
                    modifier = Modifier.testTag("nav_tab_chat")
                )

                // Perfil Tab
                NavigationBarItem(
                    selected = uiState.currentTab == AppTab.PERFIL,
                    onClick = { viewModel.setTab(AppTab.PERFIL) },
                    icon = {
                        Icon(
                            imageVector = if (uiState.currentTab == AppTab.PERFIL) Icons.Filled.Person else Icons.Outlined.Person,
                            contentDescription = "Perfil"
                        )
                    },
                    label = { Text("Perfil") },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MossGreenPrimary,
                        selectedTextColor = MossGreenPrimary,
                        indicatorColor = MossGreenContainer
                    ),
                    modifier = Modifier.testTag("nav_tab_perfil")
                )
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (uiState.currentTab) {
                AppTab.DIARIO -> {
                    DiarioScreen(
                        entries = todayEntries,
                        dailyGoal = dailyGoal,
                        waterIntake = todayWater,
                        weeklyStats = weeklyStats,
                        onAddWater = { ml -> viewModel.addWater(ml) },
                        onRemoveWater = { viewModel.removeWater() },
                        onDeleteEntry = { id -> viewModel.deleteFoodEntry(id) },
                        onNavigateToScanner = { viewModel.setTab(AppTab.SCANNER) },
                        onNavigateToBuscar = { viewModel.setTab(AppTab.BUSCAR) }
                    )
                }
                AppTab.SCANNER -> {
                    ScannerScreen(
                        isScanning = uiState.isScanning,
                        scannedResult = uiState.scannedResult,
                        onPerformScan = { prompt -> viewModel.performFoodScan(prompt) },
                        onSaveScannedMeal = { mealType, portion -> viewModel.saveScannedMeal(mealType, portion) },
                        onClearScan = { viewModel.clearScannedResult() }
                    )
                }
                AppTab.BUSCAR -> {
                    BuscarScreen(
                        foods = searchResults,
                        searchQuery = uiState.searchQuery,
                        onSearchQueryChange = { q -> viewModel.setSearchQuery(q) },
                        onAddFoodToDiary = { name, cal, carbs, prot, fat, portion, mealType ->
                            viewModel.addFoodToDiary(name, cal, carbs, prot, fat, portion, mealType)
                        },
                        onCreateCustomFood = { name, cal, carbs, prot, fat, portion, category ->
                            viewModel.createCustomFood(name, cal, carbs, prot, fat, portion, category)
                        }
                    )
                }
                AppTab.CHAT -> {
                    ChatScreen(
                        messages = chatMessages,
                        isGenerating = uiState.isChatGenerating,
                        onSendMessage = { text -> viewModel.sendChatMessage(text) },
                        onClearChat = { viewModel.clearChat() }
                    )
                }
                AppTab.PERFIL -> {
                    PerfilScreen(
                        profile = userProfile,
                        dailyGoal = dailyGoal,
                        onUpdateProfile = { updated -> viewModel.updateProfile(updated) },
                        onUpdateGoals = { cal, carbs, prot, fat, water ->
                            viewModel.updateGoals(cal, carbs, prot, fat, water)
                        },
                        onOpenPremium = { viewModel.openPremiumModal() }
                    )
                }
            }

            if (uiState.isPremiumModalOpen) {
                PremiumModal(
                    onDismiss = { viewModel.closePremiumModal() },
                    onSubscribe = { plan -> viewModel.subscribePremium(plan) }
                )
            }
        }
    }
}
