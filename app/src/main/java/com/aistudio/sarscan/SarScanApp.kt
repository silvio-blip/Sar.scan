package com.aistudio.sarscan

import android.app.Application
import com.aistudio.sarscan.data.db.SarScanDatabase
import com.aistudio.sarscan.data.repository.NutritionRepository

class SarScanApp : Application() {

    lateinit var database: SarScanDatabase
        private set

    lateinit var repository: NutritionRepository
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        database = SarScanDatabase.getDatabase(this)
        repository = NutritionRepository(this, database)
    }

    companion object {
        lateinit var instance: SarScanApp
            private set
    }
}
