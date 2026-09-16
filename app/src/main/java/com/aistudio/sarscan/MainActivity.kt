package com.aistudio.sarscan

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aistudio.sarscan.ui.components.SarScanBottomNavBar
import com.aistudio.sarscan.ui.navigation.Screen
import com.aistudio.sarscan.ui.screens.BuscarScreen
import com.aistudio.sarscan.ui.screens.ChatScreen
import com.aistudio.sarscan.ui.screens.DiarioScreen
import com.aistudio.sarscan.ui.screens.PerfilScreen
import com.aistudio.sarscan.ui.screens.ScannerScreen
import com.aistudio.sarscan.ui.theme.SarScanTheme
import com.aistudio.sarscan.viewmodel.NutritionViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: NutritionViewModel by viewModels {
        NutritionViewModel.Factory((application as SarScanApp).repository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            SarScanTheme {
                SarScanAppMain(viewModel = viewModel)
            }
        }
    }
}

@Composable
fun SarScanAppMain(viewModel: NutritionViewModel) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Scanner.route

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            SarScanBottomNavBar(
                currentRoute = currentRoute,
                onNavigate = { route ->
                    navController.navigate(route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Scanner.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Scanner.route) {
                ScannerScreen(viewModel = viewModel)
            }
            composable(Screen.Diario.route) {
                DiarioScreen(viewModel = viewModel)
            }
            composable(Screen.Buscar.route) {
                BuscarScreen(viewModel = viewModel)
            }
            composable(Screen.Chat.route) {
                ChatScreen(viewModel = viewModel)
            }
            composable(Screen.Perfil.route) {
                PerfilScreen(viewModel = viewModel)
            }
        }
    }
}
