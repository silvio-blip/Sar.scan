package com.aistudio.sarscan.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
@Entity(tableName = "water_entries")
data class WaterEntry(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val amountMl: Int,
    val date: String, // Format: YYYY-MM-DD
    val timestamp: Long = System.currentTimeMillis()
)
