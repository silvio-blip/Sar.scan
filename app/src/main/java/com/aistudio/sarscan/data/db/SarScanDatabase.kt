package com.aistudio.sarscan.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.aistudio.sarscan.data.dao.ChatMessageDao
import com.aistudio.sarscan.data.dao.FoodEntryDao
import com.aistudio.sarscan.data.dao.WaterEntryDao
import com.aistudio.sarscan.data.model.ChatMessage
import com.aistudio.sarscan.data.model.FoodEntry
import com.aistudio.sarscan.data.model.WaterEntry

@Database(
    entities = [FoodEntry::class, WaterEntry::class, ChatMessage::class],
    version = 1,
    exportSchema = false
)
abstract class SarScanDatabase : RoomDatabase() {

    abstract fun foodEntryDao(): FoodEntryDao
    abstract fun waterEntryDao(): WaterEntryDao
    abstract fun chatMessageDao(): ChatMessageDao

    companion object {
        @Volatile
        private var INSTANCE: SarScanDatabase? = null

        fun getDatabase(context: Context): SarScanDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    SarScanDatabase::class.java,
                    "sarscan_database"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
