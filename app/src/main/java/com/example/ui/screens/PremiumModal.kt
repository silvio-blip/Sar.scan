package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@Composable
fun PremiumModal(
    onDismiss: () -> Unit,
    onSubscribe: (String) -> Unit
) {
    var selectedPlan by remember { mutableStateOf("annual") }

    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp).testTag("premium_dialog"),
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                // Crown Badge
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(listOf(ApricotAccent, Color(0xFFF7B089)))
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.WorkspacePremium,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Sar.scan Premium",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                )

                Text(
                    text = "Desbloqueie o poder total da IA nutricional",
                    style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )

                Spacer(modifier = Modifier.height(18.dp))

                // Premium Features List
                val features = listOf(
                    "Scans ilimitados de refeições com IA",
                    "Análise instantânea de fotos de pratos",
                    "Nutricionista IA sem limites diários",
                    "Exportação de relatórios nutricionais em PDF",
                    "Plano alimentar personalizado por objetivos"
                )

                features.forEach { feature ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.CheckCircle,
                            contentDescription = null,
                            tint = MossGreenPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = feature,
                            style = MaterialTheme.typography.bodyMedium.copy(color = TextPrimary)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Plan cards
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // Annual
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (selectedPlan == "annual") MossGreenContainer else MaterialTheme.colorScheme.surface
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .border(
                                width = if (selectedPlan == "annual") 2.dp else 1.dp,
                                color = if (selectedPlan == "annual") MossGreenPrimary else BorderSubtle,
                                shape = RoundedCornerShape(16.dp)
                            )
                            .clickable { selectedPlan = "annual" }
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = ApricotAccent
                            ) {
                                Text(
                                    text = "ECONOMIZE 40%",
                                    style = MaterialTheme.typography.labelSmall.copy(color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold),
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("Anual", fontWeight = FontWeight.Bold)
                            Text("R$ 14,90/mês", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                        }
                    }

                    // Monthly
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (selectedPlan == "monthly") MossGreenContainer else MaterialTheme.colorScheme.surface
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .border(
                                width = if (selectedPlan == "monthly") 2.dp else 1.dp,
                                color = if (selectedPlan == "monthly") MossGreenPrimary else BorderSubtle,
                                shape = RoundedCornerShape(16.dp)
                            )
                            .clickable { selectedPlan = "monthly" }
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Text("Mensal", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("R$ 24,90/mês", style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary))
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSubscribe(selectedPlan) },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MossGreenPrimary),
                modifier = Modifier.fillMaxWidth().height(48.dp).testTag("subscribe_premium_button")
            ) {
                Text("Assinar Agora", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Depois", color = TextSecondary)
            }
        }
    )
}
