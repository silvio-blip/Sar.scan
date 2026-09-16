package com.aistudio.sarscan.data.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aistudio.sarscan.data.model.FoodEntry
import kotlinx.coroutines.flow.Flow

@Dao
interface FoodEntryDao {

    @Query("SELECT * FROM food_entries WHERE date = :date ORDER BY timestamp DESC")
    fun getEntriesForDate(date: String): Flow<List<FoodEntry>>

    @Query("SELECT * FROM food_entries ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentEntries(limit: Int = 20): Flow<List<FoodEntry>>

    @Query("SELECT SUM(calories) FROM food_entries WHERE date = :date")
    fun getTotalCaloriesForDate(date: String): Flow<Double?>

    @Query("SELECT SUM(protein) FROM food_entries WHERE date = :date")
    fun getTotalProteinForDate(date: String): Flow<Double?>

    @Query("SELECT SUM(carbs) FROM food_entries WHERE date = :date")
    fun getTotalCarbsForDate(date: String): Flow<Double?>

    @Query("SELECT SUM(fat) FROM food_entries WHERE date = :date")
    fun getTotalFatForDate(date: String): Flow<Double?>

    @Query("SELECT date, SUM(calories) as totalCalories FROM food_entries GROUP BY date ORDER BY date DESC LIMIT 7")
    suspend fun getWeeklyCaloriesHistory(): List<WeeklyCalorieStat>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEntry(entry: FoodEntry): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEntries(entries: List<FoodEntry>)

    @Delete
    suspend fun deleteEntry(entry: FoodEntry)

    @Query("DELETE FROM food_entries WHERE id = :id")
    suspend fun deleteEntryById(id: Long)
}

data class WeeklyCalorieStat(
    val date: String,
    val totalCalories: Double
)
