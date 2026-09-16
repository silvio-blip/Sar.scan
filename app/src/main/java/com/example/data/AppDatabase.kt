package com.example.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Database(
    entities = [
        FoodEntryEntity::class,
        DailyGoalEntity::class,
        WaterIntakeEntity::class,
        FoodBasicEntity::class,
        ChatMessageEntity::class,
        UserProfileEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun foodEntryDao(): FoodEntryDao
    abstract fun dailyGoalDao(): DailyGoalDao
    abstract fun waterIntakeDao(): WaterIntakeDao
    abstract fun foodBasicDao(): FoodBasicDao
    abstract fun chatMessageDao(): ChatMessageDao
    abstract fun userProfileDao(): UserProfileDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "sar_scan_database"
                )
                    .addCallback(DatabaseCallback())
                    .build()
                INSTANCE = instance
                instance
            }
        }

        private class DatabaseCallback : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    CoroutineScope(Dispatchers.IO).launch {
                        populateInitialData(database)
                    }
                }
            }
        }

        private suspend fun populateInitialData(database: AppDatabase) {
            // Initial Daily Goal
            database.dailyGoalDao().setGoal(
                DailyGoalEntity(
                    id = 1,
                    calorias = 2000,
                    carbsG = 220,
                    proteinaG = 140,
                    gorduraG = 60,
                    waterMl = 2500
                )
            )

            // Initial User Profile
            database.userProfileDao().updateProfile(
                UserProfileEntity(
                    id = 1,
                    nome = "Silvio",
                    email = "silvio@exemplo.com",
                    pesoKg = 74.0,
                    alturaCm = 178.0,
                    idade = 26,
                    genero = "Masculino",
                    nivelAtividade = "Moderadamente Ativo",
                    objetivo = "Ganhar Massa",
                    streakDays = 5,
                    isPremium = false
                )
            )

            // Initial Food Catalogue (rich selection of Brazilian & common foods)
            val foods = listOf(
                FoodBasicEntity(nome = "Arroz Branco Cozido", cal = 128, carb = 28.1, prot = 2.5, gord = 0.2, porcao = "100g", categoria = "Carboidratos"),
                FoodBasicEntity(nome = "Arroz Integral Cozido", cal = 111, carb = 23.0, prot = 2.6, gord = 0.9, porcao = "100g", categoria = "Carboidratos"),
                FoodBasicEntity(nome = "Feijão Carioca Cozido", cal = 76, carb = 13.6, prot = 4.8, gord = 0.5, porcao = "100g", categoria = "Leguminosas"),
                FoodBasicEntity(nome = "Feijão Preto Cozido", cal = 77, carb = 14.0, prot = 4.5, gord = 0.5, porcao = "100g", categoria = "Leguminosas"),
                FoodBasicEntity(nome = "Peito de Frango Grelhado", cal = 159, carb = 0.0, prot = 32.0, gord = 3.2, porcao = "100g", categoria = "Proteínas"),
                FoodBasicEntity(nome = "Carne Moída de Patinho", cal = 185, carb = 0.0, prot = 31.5, gord = 6.0, porcao = "100g", categoria = "Proteínas"),
                FoodBasicEntity(nome = "Filé de Tilápia Grelhado", cal = 128, carb = 0.0, prot = 26.0, gord = 2.7, porcao = "100g", categoria = "Proteínas"),
                FoodBasicEntity(nome = "Filé de Salmão Grelhado", cal = 206, carb = 0.0, prot = 22.0, gord = 13.0, porcao = "100g", categoria = "Proteínas"),
                FoodBasicEntity(nome = "Ovo Cozido", cal = 155, carb = 1.1, prot = 13.0, gord = 11.0, porcao = "100g (2 unid)", categoria = "Proteínas"),
                FoodBasicEntity(nome = "Ovos Mexidos (com azeite)", cal = 180, carb = 1.5, prot = 12.0, gord = 14.0, porcao = "100g (2 unid)", categoria = "Proteínas"),
                FoodBasicEntity(nome = "Batata Doce Cozida", cal = 86, carb = 20.1, prot = 1.6, gord = 0.1, porcao = "100g", categoria = "Carboidratos"),
                FoodBasicEntity(nome = "Mandioca / Aipim Cozido", cal = 125, carb = 30.0, prot = 1.2, gord = 0.3, porcao = "100g", categoria = "Carboidratos"),
                FoodBasicEntity(nome = "Tapioca (Goma)", cal = 240, carb = 60.0, prot = 0.2, gord = 0.1, porcao = "100g", categoria = "Carboidratos"),
                FoodBasicEntity(nome = "Banana Prata", cal = 89, carb = 22.8, prot = 1.1, gord = 0.3, porcao = "100g (1 unid)", categoria = "Frutas"),
                FoodBasicEntity(nome = "Maçã Fuji", cal = 52, carb = 13.8, prot = 0.3, gord = 0.2, porcao = "100g", categoria = "Frutas"),
                FoodBasicEntity(nome = "Mamão Papaia", cal = 43, carb = 10.8, prot = 0.5, gord = 0.3, porcao = "100g", categoria = "Frutas"),
                FoodBasicEntity(nome = "Abacate", cal = 160, carb = 8.5, prot = 2.0, gord = 14.7, porcao = "100g", categoria = "Frutas"),
                FoodBasicEntity(nome = "Açaí na Tigela (Puro)", cal = 110, carb = 12.0, prot = 1.5, gord = 6.2, porcao = "100g", categoria = "Frutas"),
                FoodBasicEntity(nome = "Aveia em Flocos", cal = 389, carb = 66.3, prot = 16.9, gord = 6.9, porcao = "100g", categoria = "Cereais"),
                FoodBasicEntity(nome = "Pão Francês", cal = 300, carb = 58.7, prot = 9.0, gord = 3.1, porcao = "100g (2 unid)", categoria = "Pães"),
                FoodBasicEntity(nome = "Pão Integral 100%", cal = 240, carb = 44.0, prot = 11.0, gord = 3.0, porcao = "100g (2 fatias)", categoria = "Pães"),
                FoodBasicEntity(nome = "Queijo Minas Frescal", cal = 227, carb = 3.2, prot = 17.4, gord = 16.0, porcao = "100g", categoria = "Laticínios"),
                FoodBasicEntity(nome = "Queijo Mussarela", cal = 280, carb = 2.2, prot = 22.0, gord = 21.0, porcao = "100g", categoria = "Laticínios"),
                FoodBasicEntity(nome = "Iogurte Natural Desnatado", cal = 43, carb = 5.0, prot = 4.0, gord = 0.2, porcao = "100g", categoria = "Laticínios"),
                FoodBasicEntity(nome = "Leite Desnatado", cal = 35, carb = 5.0, prot = 3.4, gord = 0.1, porcao = "100ml", categoria = "Laticínios"),
                FoodBasicEntity(nome = "Whey Protein 80%", cal = 400, carb = 5.0, prot = 80.0, gord = 4.0, porcao = "100g (3 scoops)", categoria = "Suplementos"),
                FoodBasicEntity(nome = "Creatina Monoidratada", cal = 0, carb = 0.0, prot = 0.0, gord = 0.0, porcao = "5g", categoria = "Suplementos"),
                FoodBasicEntity(nome = "Azeite de Oliva Extra Virgem", cal = 884, carb = 0.0, prot = 0.0, gord = 100.0, porcao = "100g (1 colher)", categoria = "Gorduras"),
                FoodBasicEntity(nome = "Pasta de Amendoim Integral", cal = 588, carb = 20.0, prot = 25.0, gord = 50.0, porcao = "100g", categoria = "Gorduras"),
                FoodBasicEntity(nome = "Castanha do Pará", cal = 656, carb = 12.0, prot = 14.3, gord = 66.4, porcao = "100g", categoria = "Gorduras"),
                FoodBasicEntity(nome = "Brócolis Cozido", cal = 35, carb = 7.2, prot = 2.4, gord = 0.4, porcao = "100g", categoria = "Vegetais"),
                FoodBasicEntity(nome = "Salada Verde (Alface/Rúcula/Tomate)", cal = 18, carb = 3.5, prot = 1.2, gord = 0.2, porcao = "100g", categoria = "Vegetais")
            )
            database.foodBasicDao().insertAll(foods)

            // Seed sample food entries for today and past few days for rich initial experience
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            val yesterday = LocalDate.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
            val day2 = LocalDate.now().minusDays(2).format(DateTimeFormatter.ISO_LOCAL_DATE)

            database.foodEntryDao().insertEntry(
                FoodEntryEntity(
                    nome = "Ovos Mexidos com Pão Integral",
                    calorias = 320,
                    carbs = 26.0,
                    prot = 18.0,
                    gord = 14.0,
                    porcoes = 1.0,
                    data = today,
                    mealType = "Café da Manhã"
                )
            )
            database.foodEntryDao().insertEntry(
                FoodEntryEntity(
                    nome = "Peito de Frango com Arroz e Feijão",
                    calorias = 540,
                    carbs = 58.0,
                    prot = 45.0,
                    gord = 8.0,
                    porcoes = 1.0,
                    data = today,
                    mealType = "Almoço"
                )
            )
            database.foodEntryDao().insertEntry(
                FoodEntryEntity(
                    nome = "Whey Protein com Banana",
                    calorias = 230,
                    carbs = 27.0,
                    prot = 25.0,
                    gord = 2.0,
                    porcoes = 1.0,
                    data = today,
                    mealType = "Lanches"
                )
            )

            // Past days sample entries for weekly charts
            database.foodEntryDao().insertEntry(FoodEntryEntity(nome = "Refeições Dia Anterior", calorias = 1920, carbs = 210.0, prot = 135.0, gord = 55.0, porcoes = 1.0, data = yesterday, mealType = "Almoço"))
            database.foodEntryDao().insertEntry(FoodEntryEntity(nome = "Refeições 2 Dias Atrás", calorias = 1850, carbs = 195.0, prot = 142.0, gord = 58.0, porcoes = 1.0, data = day2, mealType = "Almoço"))

            // Seed initial water intake
            database.waterIntakeDao().insertWater(WaterIntakeEntity(data = today, ml = 500))
            database.waterIntakeDao().insertWater(WaterIntakeEntity(data = today, ml = 350))
            database.waterIntakeDao().insertWater(WaterIntakeEntity(data = today, ml = 500))
            database.waterIntakeDao().insertWater(WaterIntakeEntity(data = yesterday, ml = 2200))
            database.waterIntakeDao().insertWater(WaterIntakeEntity(data = day2, ml = 2500))

            // Seed welcome chat message
            database.chatMessageDao().insertMessage(
                ChatMessageEntity(
                    role = "assistant",
                    content = "Olá Silvio! Sou seu Nutricionista IA da Sar.scan. Posso te ajudar a calcular seus macronutrientes ideais, sugerir refeições saudáveis, analisar pratos ou tirar dúvidas sobre sua dieta. Como posso te ajudar hoje?"
                )
            )
        }
    }
}
