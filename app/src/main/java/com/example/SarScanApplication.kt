package com.example

import android.app.Application

class SarScanApplication : Application() {
    val database: com.example.data.AppDatabase by lazy {
        com.example.data.AppDatabase.getDatabase(this)
    }

    val repository: com.example.data.NutritionRepository by lazy {
        com.example.data.NutritionRepository(
            foodEntryDao = database.foodEntryDao(),
            dailyGoalDao = database.dailyGoalDao(),
            waterIntakeDao = database.waterIntakeDao(),
            foodBasicDao = database.foodBasicDao(),
            chatMessageDao = database.chatMessageDao(),
            userProfileDao = database.userProfileDao()
        )
    }
}
