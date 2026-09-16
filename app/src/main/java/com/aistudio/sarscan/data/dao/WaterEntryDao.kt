package com.aistudio.sarscan.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aistudio.sarscan.data.model.WaterEntry
import kotlinx.coroutines.flow.Flow

@Dao
interface WaterEntryDao {

    @Query("SELECT * FROM water_entries WHERE date = :date ORDER BY timestamp DESC")
    fun getWaterEntriesForDate(date: String): Flow<List<WaterEntry>>

    @Query("SELECT SUM(amountMl) FROM water_entries WHERE date = :date")
    fun getTotalWaterForDate(date: String): Flow<Int?>

    @Query("SELECT date, SUM(amountMl) as totalMl FROM water_entries GROUP BY date ORDER BY date DESC LIMIT 7")
    suspend fun getWeeklyWaterHistory(): List<WeeklyWaterStat>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWaterEntry(entry: WaterEntry): Long

    @Query("DELETE FROM water_entries WHERE id = (SELECT id FROM water_entries WHERE date = :date ORDER BY timestamp DESC LIMIT 1)")
    suspend fun deleteLatestForDate(date: String)
}

data class WeeklyWaterStat(
    val date: String,
    val totalMl: Int
)
