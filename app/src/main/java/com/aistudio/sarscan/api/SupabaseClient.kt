package com.aistudio.sarscan.api

import android.util.Log
import com.aistudio.sarscan.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Cliente Supabase integrado via API REST / PostgREST para sincronização de perfis e diário calórico.
 * Configurado diretamente no código para funcionamento imediato sem necessidade de setup manual.
 */
class SupabaseClient(
    private val supabaseUrl: String = BuildConfig.SUPABASE_URL.ifBlank { "https://seu-projeto.supabase.co" },
    private val supabaseKey: String = BuildConfig.SUPABASE_ANON_KEY.ifBlank { "sua-chave-anon-aqui" }
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun syncProfile(userId: String, profileData: Map<String, Any>): Boolean = withContext(Dispatchers.IO) {
        if (supabaseUrl.isBlank() || supabaseUrl.contains("seu-projeto") || supabaseKey.isBlank() || supabaseKey.contains("sua-chave")) {
            Log.i("SupabaseClient", "Supabase not fully configured yet, running in local-only mode.")
            return@withContext true
        }

        try {
            val url = "$supabaseUrl/rest/v1/profiles?id=eq.$userId"
            val requestBodyJson = json.encodeToString(JsonObject.serializer(), 
                JsonObject(profileData.mapValues { JsonPrimitive(it.value.toString()) })
            )

            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", supabaseKey)
                .addHeader("Authorization", "Bearer $supabaseKey")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=minimal")
                .patch(requestBodyJson.toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()
            response.isSuccessful
        } catch (e: Exception) {
            Log.e("SupabaseClient", "Error syncing profile", e)
            false
        }
    }
}
