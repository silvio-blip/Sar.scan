package com.example.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface FoodEntryDao {
    @Query("SELECT * FROM food_entries WHERE data = :date ORDER BY createdAt DESC")
    fun getEntriesForDate(date: String): Flow<List<FoodEntryEntity>>

    @Query("SELECT * FROM food_entries WHERE data >= :startDate ORDER BY data ASC, createdAt ASC")
    fun getEntriesSinceDate(startDate: String): Flow<List<FoodEntryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEntry(entry: FoodEntryEntity): Long

    @Update
    suspend fun updateEntry(entry: FoodEntryEntity)

    @Delete
    suspend fun deleteEntry(entry: FoodEntryEntity)

    @Query("DELETE FROM food_entries WHERE id = :id")
    suspend fun deleteById(id: Long)
}

@Dao
interface DailyGoalDao {
    @Query("SELECT * FROM daily_goals WHERE id = 1 LIMIT 1")
    fun getGoal(): Flow<DailyGoalEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setGoal(goal: DailyGoalEntity)
}

@Dao
interface WaterIntakeDao {
    @Query("SELECT * FROM water_intake WHERE data = :date ORDER BY createdAt ASC")
    fun getWaterForDate(date: String): Flow<List<WaterIntakeEntity>>

    @Query("SELECT * FROM water_intake WHERE data >= :startDate ORDER BY data ASC")
    fun getWaterSinceDate(startDate: String): Flow<List<WaterIntakeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWater(intake: WaterIntakeEntity): Long

    @Query("DELETE FROM water_intake WHERE id = (SELECT id FROM water_intake WHERE data = :date ORDER BY createdAt DESC LIMIT 1)")
    suspend fun removeLastWaterForDate(date: String)
}

@Dao
interface FoodBasicDao {
    @Query("SELECT * FROM foods_basic ORDER BY nome ASC")
    fun getAllFoods(): Flow<List<FoodBasicEntity>>

    @Query("SELECT * FROM foods_basic WHERE nome LIKE '%' || :query || '%' OR categoria LIKE '%' || :query || '%' ORDER BY nome ASC")
    fun searchFoods(query: String): Flow<List<FoodBasicEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(foods: List<FoodBasicEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFood(food: FoodBasicEntity): Long

    @Query("SELECT COUNT(*) FROM foods_basic")
    suspend fun count(): Int
}

@Dao
interface ChatMessageDao {
    @Query("SELECT * FROM chat_messages ORDER BY createdAt ASC")
    fun getAllMessages(): Flow<List<ChatMessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: ChatMessageEntity): Long

    @Query("DELETE FROM chat_messages")
    suspend fun clearHistory()
}

@Dao
interface UserProfileDao {
    @Query("SELECT * FROM user_profile WHERE id = 1 LIMIT 1")
    fun getProfile(): Flow<UserProfileEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun updateProfile(profile: UserProfileEntity)
}
