package com.aistudio.sarscan.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class GeminiRequest(
    val contents: List<Content>,
    val generationConfig: GenerationConfig? = null
)

@Serializable
data class Content(
    val role: String? = "user",
    val parts: List<Part>
)

@Serializable
data class Part(
    val text: String? = null,
    @SerialName("inline_data")
    val inlineData: InlineData? = null
)

@Serializable
data class InlineData(
    @SerialName("mime_type")
    val mimeType: String,
    val data: String // base64 encoded
)

@Serializable
data class GenerationConfig(
    val temperature: Float? = 0.2f,
    @SerialName("response_mime_type")
    val responseMimeType: String? = null
)

@Serializable
data class GeminiResponse(
    val candidates: List<Candidate>? = null
)

@Serializable
data class Candidate(
    val content: ContentResponse? = null
)

@Serializable
data class ContentResponse(
    val parts: List<PartResponse>? = null
)

@Serializable
data class PartResponse(
    val text: String? = null
)

@Serializable
data class ScannedFoodAnalysis(
    val mealName: String,
    val estimatedCalories: Double,
    val proteinGrams: Double,
    val carbsGrams: Double,
    val fatGrams: Double,
    val portionDescription: String,
    val healthTip: String,
    val items: List<ScannedItemDetail> = emptyList()
)

@Serializable
data class ScannedItemDetail(
    val name: String,
    val calories: Double,
    val protein: Double,
    val carbs: Double,
    val fat: Double,
    val portion: String
)
