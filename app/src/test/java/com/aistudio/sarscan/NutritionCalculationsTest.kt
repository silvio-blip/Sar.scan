package com.aistudio.sarscan

import com.aistudio.sarscan.data.model.FoodCatalogItem
import com.aistudio.sarscan.data.model.UserProfile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NutritionCalculationsTest {

    @Test
    fun testFoodCatalogGramsCalculation() {
        val chicken = FoodCatalogItem(
            id = "1",
            name = "Peito de Frango",
            category = "Proteínas",
            caloriesPer100g = 165.0,
            carbsPer100g = 0.0,
            proteinPer100g = 31.0,
            fatPer100g = 3.6,
            defaultPortionGrams = 100.0
        )

        val entry200g = chicken.calculateForGrams(200.0)
        assertEquals(330.0, entry200g.calories, 0.1)
        assertEquals(62.0, entry200g.protein, 0.1)
        assertEquals(7.2, entry200g.fat, 0.1)
        assertEquals("200g", entry200g.portion)
    }

    @Test
    fun testUserProfileDefaults() {
        val profile = UserProfile()
        assertTrue(profile.targetCalories >= 1500)
        assertTrue(profile.targetWaterMl >= 2000)
        assertTrue(profile.targetProteinG > 50)
    }
}
