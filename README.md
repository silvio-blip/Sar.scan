# Sar.scan - Nutrição Inteligente com IA

**Sar.scan** é um aplicativo Android nativo desenvolvido em **Kotlin** e **Jetpack Compose (Material 3)** para escaneamento inteligente de refeições com inteligência artificial, contagem automática de calorias e controle completo de diário calórico e hidratação.

---

## 📱 Recursos Principais

1. **Scanner de Alimentos com IA (Gemini 2.5 Flash)**
   - Enquadre qualquer prato ou envie fotos da sua galeria.
   - A IA identifica múltiplos itens no mesmo prato (ex: Arroz, Feijão, Frango Grelhado, Salada), estimando calorias individuais, carboidratos, proteínas e gorduras com base em porções reais.
   - Modal interativo (`MultiFoodModal`) permitindo selecionar quais itens registrar, ajustar a refeição (Café, Almoço, Jantar, Lanche) e salvar com um clique.

2. **Diário Calórico & Gauge de Metas**
   - Gráfico de anel dinâmico indicando calorias consumidas, meta diária e restante.
   - Barras de progresso visual para macronutrientes: Carboidratos, Proteínas e Gorduras.
   - Listagem em tempo real de todas as refeições do dia com histórico, tipo de refeição, macros e opção de exclusão.
   - Adição manual rápida de alimentos com cálculo de nutrientes.

3. **Rastreador de Hidratação**
   - Registro instantâneo de água com botões rápidos (+150 ml, +250 ml, +500 ml).
   - Barra de progresso interativa comparando o consumo diário com a meta de hidratação.

4. **Catálogo Nutricional & Busca de Alimentos**
   - Banco de dados local baseado na Tabela TACO brasileira de composição de alimentos.
   - Filtros por categorias: _Proteínas_, _Carboidratos_, _Frutas_, _Laticínios_, _Gorduras Saudáveis_.
   - Seletor de porção em gramas com recálculo instantâneo de macros e calorias antes de registrar no diário.

5. **Nutri IA (Assistente Conversacional)**
   - Chatbot especializado em nutrição, com sugestões rápidas de prompts para orientações de pré/pós-treino, déficit calórico e escolhas saudáveis.
   - Histórico de mensagens persistido localmente via Room.

6. **Perfil & Metas Personalizadas**
   - Configuração de metas com base no objetivo (_Perder peso_, _Manter peso_, _Ganhar massa_).
   - Cálculo e sugestão automática de ingestão de calorias e divisão de macronutrientes.
   - Contador de ofensiva (_streaks_) e estatísticas de escaneamentos realizados.

---

## 🛠️ Arquitetura & Tecnologias

- **Linguagem**: Kotlin 2.0+
- **Interface**: Jetpack Compose com Material Design 3 (M3) e suporte completo a Edge-to-Edge
- **Banco de Dados Local**: Room Database (`food_entries`, `water_entries`, `chat_messages`)
- **Assincronia & Reatividade**: Kotlin Coroutines & `StateFlow`
- **IA Generativa**: Google Gemini API via OkHttp / Kotlinx Serialization
- **Ícone Adaptativo**: Vetores personalizados com suporte a adaptive launcher icons (`res/mipmap-anydpi-v26/`)
- **Arquitetura**: MVVM (Model-View-ViewModel) com padrão Repository

---

## 🚀 Como Compilar e Executar

1. Abra o projeto no **Android Studio Hedgehog ou superior**.
2. Configure a JDK 21 em `Settings > Build, Execution, Deployment > Build Tools > Gradle`.
3. Adicione sua chave da API Gemini no painel de Secrets ou no arquivo `.env`:
   ```bash
   GEMINI_API_KEY=sua_chave_aqui
   ```
4. Execute no emulador ou dispositivo físico:
   ```bash
   ./gradlew assembleDebug
   ```
   O APK gerado estará em `app/build/outputs/apk/debug/app-debug.apk`.
