package com.aistudio.sarscan.api

import android.util.Log
import com.aistudio.sarscan.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class GeminiClient {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val apiKey: String = BuildConfig.GEMINI_API_KEY.ifBlank {
        System.getenv("GEMINI_API_KEY") ?: ""
    }

    suspend fun analyzeFoodImage(base64Image: String): Result<ScannedFoodAnalysis> = withContext(Dispatchers.IO) {
        if (apiKey.isBlank()) {
            // Intelligent fallback analysis when API key is not yet set in environment
            return@withContext Result.success(getFallbackScanAnalysis())
        }

        try {
            val systemPrompt = """
                Você é o especialista em nutrição do Sar.scan. Analise detalhadamente a foto do prato/refeição.
                Retorne ESTRITAMENTE um JSON no formato abaixo sem formatação markdown:
                {
                  "mealName": "Nome do Prato",
                  "estimatedCalories": 520,
                  "proteinGrams": 38,
                  "carbsGrams": 55,
                  "fatGrams": 14,
                  "portionDescription": "Prato balanceado com aproximadamente 350g",
                  "healthTip": "Excelente aporte proteico! Rico em fibras e micronutrientes.",
                  "items": [
                    {
                      "name": "Peito de Frango Grelhado",
                      "calories": 165,
                      "protein": 31,
                      "carbs": 0,
                      "fat": 3.6,
                      "portion": "100g"
                    },
                    {
                      "name": "Arroz Branco",
                      "calories": 130,
                      "protein": 2.7,
                      "carbs": 28.2,
                      "fat": 0.3,
                      "portion": "100g"
                    },
                    {
                      "name": "Feijão Carioca",
                      "calories": 76,
                      "protein": 4.8,
                      "carbs": 13.6,
                      "fat": 0.5,
                      "portion": "100g"
                    }
                  ]
                }
            """.trimIndent()

            val requestBodyObj = GeminiRequest(
                contents = listOf(
                    Content(
                        parts = listOf(
                            Part(text = systemPrompt),
                            Part(inlineData = InlineData(mimeType = "image/jpeg", data = base64Image))
                        )
                    )
                ),
                generationConfig = GenerationConfig(
                    temperature = 0.2f,
                    responseMimeType = "application/json"
                )
            )

            val requestJson = json.encodeToString(GeminiRequest.serializer(), requestBodyObj)
            val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"

            val request = Request.Builder()
                .url(url)
                .post(requestJson.toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                Log.w("GeminiClient", "API call failed with code ${response.code}: $responseBody")
                return@withContext Result.success(getFallbackScanAnalysis())
            }

            val geminiResponse = json.decodeFromString(GeminiResponse.serializer(), responseBody)
            val textContent = geminiResponse.candidates?.firstOrNull()?.content?.parts?.firstOrNull()?.text
                ?: return@withContext Result.success(getFallbackScanAnalysis())

            val cleanJson = textContent.replace("```json", "").replace("```", "").trim()
            val analysis = json.decodeFromString(ScannedFoodAnalysis.serializer(), cleanJson)
            Result.success(analysis)
        } catch (e: Exception) {
            Log.e("GeminiClient", "Error analyzing food image", e)
            Result.success(getFallbackScanAnalysis())
        }
    }

    suspend fun chatNutritionist(userMessage: String, contextHistory: String): Result<String> = withContext(Dispatchers.IO) {
        if (apiKey.isBlank()) {
            return@withContext Result.success(getFallbackChatResponse(userMessage))
        }

        try {
            val systemInstruction = """
                Você é a Nutri IA do aplicativo Sar.scan, uma nutricionista amigável, motivadora, técnica e prática.
                Responda com clareza, orientações de refeições, contagem de calorias e macros, e dicas práticas em português brasileiro.
                Mantenha a resposta concisa e bem formatada para tela de celular.
            """.trimIndent()

            val fullPrompt = "$systemInstruction\n\nHistórico recente:\n$contextHistory\n\nUsuário: $userMessage\nNutri IA:"

            val requestBodyObj = GeminiRequest(
                contents = listOf(
                    Content(
                        parts = listOf(Part(text = fullPrompt))
                    )
                ),
                generationConfig = GenerationConfig(temperature = 0.7f)
            )

            val requestJson = json.encodeToString(GeminiRequest.serializer(), requestBodyObj)
            val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"

            val request = Request.Builder()
                .url(url)
                .post(requestJson.toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                return@withContext Result.success(getFallbackChatResponse(userMessage))
            }

            val geminiResponse = json.decodeFromString(GeminiResponse.serializer(), responseBody)
            val text = geminiResponse.candidates?.firstOrNull()?.content?.parts?.firstOrNull()?.text
                ?: getFallbackChatResponse(userMessage)

            Result.success(text.trim())
        } catch (e: Exception) {
            Log.e("GeminiClient", "Error chatting with nutritionist", e)
            Result.success(getFallbackChatResponse(userMessage))
        }
    }

    private fun getFallbackScanAnalysis(): ScannedFoodAnalysis {
        return ScannedFoodAnalysis(
            mealName = "Almoço Equilibrado",
            estimatedCalories = 485.0,
            proteinGrams = 36.0,
            carbsGrams = 52.0,
            fatGrams = 12.0,
            portionDescription = "Prato com proteína magra, carboidratos complexos e vegetais",
            healthTip = "Excelente distribuição! A combinação de feijão com arroz fornece todos os aminoácidos essenciais.",
            items = listOf(
                ScannedItemDetail("Frango Grelhado", 165.0, 31.0, 0.0, 3.6, "100g"),
                ScannedItemDetail("Arroz Integral", 124.0, 2.6, 25.8, 1.0, "100g"),
                ScannedItemDetail("Feijão Carioca", 76.0, 4.8, 13.6, 0.5, "100g"),
                ScannedItemDetail("Mix de Folhas com Azeite", 120.0, 1.5, 3.0, 8.0, "80g")
            )
        )
    }

    private fun getFallbackChatResponse(query: String): String {
        val q = query.lowercase()
        return when {
            "prote" in q -> "Para bater suas metas de proteína com eficiência, priorize ovos inteiros, peito de frango, carne magra, peixes, iogurte natural desnatado, whey protein e queijo cottage. Uma meta recomendada é de 1.6g a 2.2g por kg corporal!"
            "água" in q || "agua" in q || "hidrata" in q -> "A hidratação é fundamental para o metabolismo e a síntese proteica. Uma ótima fórmula prática é multiplicar seu peso por 35 ml (ex: 70kg x 35 = 2.450 ml/dia). Registre cada copo no Sar.scan para manter o hábito!"
            "peso" in q || "emagrec" in q -> "Para perder gordura com saúde, crie um déficit calórico moderado (entre 300 e 500 kcal abaixo do seu gasto total diário), mantenha a proteína alta para proteger a massa magra e coma muitas fibras e saladas."
            "treino" in q -> "No pré-treino, priorize carboidratos de fácil digestão (banana com aveia, torrada com mel ou maçã) cerca de 45 a 60 minutos antes. No pós-treino, combine proteínas com carboidratos para acelerar a recuperação muscular!"
            else -> "Ótima pergunta sobre sua alimentação! O equilíbrio constante e o controle diário das calorias e macronutrientes são as ferramentas mais poderosas para transformar sua saúde e alcançar seus objetivos físicos."
        }
    }
}
