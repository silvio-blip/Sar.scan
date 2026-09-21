import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ShieldAlert,
  FileText,
  Shield,
  ArrowLeft,
  Copy,
  Check,
  Scale,
  Database,
  Lock,
  UserCheck,
  AlertOctagon,
  LifeBuoy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SarLogo } from "@/components/sar-logo";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/direitos-privacidade")({
  component: DireitosPrivacidadePage,
});

function DireitosPrivacidadePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"termos" | "privacidade">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "privacidade" || tab === "termos") {
        return tab;
      }
    }
    return "termos";
  });
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link da página copiado com sucesso!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBack = () => {
    if (user) {
      navigate({ to: "/perfil" });
    } else {
      navigate({ to: "/login" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-start px-4 py-8 md:py-12 relative overflow-hidden">
      {/* Premium organic liquid fluid decorative blobs */}
      <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80vw] h-[80vw] sm:w-[50vw] sm:h-[50vw] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-3xl space-y-6 md:space-y-8 z-10">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="rounded-full bg-card/65 border border-border shadow-sm hover:bg-secondary size-10 flex items-center justify-center transition-all"
            id="back-button"
          >
            <ArrowLeft className="size-5" />
          </Button>

          <div className="flex items-center gap-2">
            <img
              src="https://i.imgur.com/pwXdv52.png"
              alt="Logo"
              className="size-6 rounded-full object-cover shadow-sm"
            />
            <span
              className="font-black text-xs uppercase tracking-[0.2em] text-primary"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif" }}
            >
              sarscan
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="rounded-full bg-card border border-border shadow-sm hover:bg-secondary h-10 px-4 flex items-center gap-2 text-xs font-bold transition-all text-primary"
            id="copy-link-button"
          >
            {copied ? (
              <>
                <Check className="size-4 text-emerald-500 animate-pulse" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                <span>Copiar Link</span>
              </>
            )}
          </Button>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-3 py-4">
          <h1
            className="text-3xl md:text-4xl font-black text-foreground tracking-tight leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Montserrat', sans-serif" }}
          >
            Direitos e Privacidade
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto font-medium leading-relaxed">
            Leia atentamente as diretrizes de uso, política de créditos e regras de processamento de
            dados do aplicativo nutricional sarscan.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1.5 bg-secondary/80 rounded-[28px] border border-border mt-2 shadow-inner">
          <button
            onClick={() => setActiveTab("termos")}
            className={`flex items-center justify-center gap-2.5 py-3 rounded-[22px] text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === "termos"
                ? "bg-card text-foreground shadow-[0_4px_16px_rgba(46,74,59,0.06)] scale-[1.01] font-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
            id="tab-terms"
          >
            <FileText className={`size-4.5 ${activeTab === "termos" ? "text-primary" : ""}`} />
            Termos de Uso
          </button>
          <button
            onClick={() => setActiveTab("privacidade")}
            className={`flex items-center justify-center gap-2.5 py-3 rounded-[22px] text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === "privacidade"
                ? "bg-card text-foreground shadow-[0_4px_16px_rgba(46,74,59,0.06)] scale-[1.01] font-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
            id="tab-privacy"
          >
            <Shield className={`size-4.5 ${activeTab === "privacidade" ? "text-primary" : ""}`} />
            Privacidade
          </button>
        </div>

        {/* Interactive Documents */}
        <AnimatePresence mode="wait">
          {activeTab === "termos" ? (
            <motion.div
              key="termos"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Alert Warning box */}
              <Card className="bg-amber-500/5 rounded-[28px] p-5 border border-amber-500/15 flex items-start gap-4">
                <ShieldAlert className="size-6 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-amber-800">
                    Isenção de Responsabilidade Médica (Crucial)
                  </h4>
                  <p className="text-[11px] font-semibold text-amber-700/95 leading-relaxed">
                    O aplicativo SAR é uma calculadora preditiva baseada em inteligência artificial.
                    Nossos resultados são estimativas e não substituem o diagnóstico ou plano
                    dietético prescrito por um médico ou nutricionista titulado. Consulte sempre um
                    profissional de saúde qualificado antes de mudar seus hábitos de nutrição.
                  </p>
                </div>
              </Card>

              {/* Terms Details */}
              <Card className="bg-card rounded-[36px] p-6 md:p-8 space-y-6 md:space-y-8 border border-border shadow-sm">
                <div className="space-y-6 text-sm font-medium leading-relaxed text-muted-foreground">
                  {/* Section 1 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Scale className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        1. Termos Gerais de Serviço
                      </h2>
                    </div>
                    <p className="pl-10 text-xs md:text-sm">
                      Ao acessar, utilizar ou realizar cadastro no aplicativo SAR, doravante
                      denominado "Serviço", você concorda e sujeita-se integralmente a estes Termos
                      de Uso e Regulamento. Caso discorde de quaisquer regras estabelecidas ou
                      limitações de licença, você deve encerrar imediatamente a sua utilização do
                      Serviço.
                    </p>
                  </div>

                  {/* Section 2 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Database className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        2. Regulamento Rígido de Créditos
                      </h2>
                    </div>
                    <div className="pl-10 space-y-2 text-xs md:text-sm">
                      <p>
                        A economia de fotos e leituras do aplicativo é medida através de créditos de
                        escaneamento (
                        <span className="text-foreground font-semibold">scans_credits</span>)
                        associados à conta do usuário:
                      </p>
                      <ul className="list-disc pl-5 space-y-1.5 font-semibold text-muted-foreground/90">
                        <li>
                          <span className="text-foreground font-bold">Plano Gratuito:</span> O
                          usuário recebe diariamente um total de exatamente{" "}
                          <span className="text-primary font-bold">3 créditos</span> para usufruir
                          gratuitamente. Estes créditos diários não são cumulativos; se não forem
                          utilizados, expiram à meia-noite e voltam a ser exatamente 3 créditos no
                          dia seguinte.
                        </li>
                        <li>
                          <span className="text-foreground font-bold">
                            Plano Premium / Compras avulsas:
                          </span>{" "}
                          A aquisição de planos ou pacotes de créditos concede créditos adicionais
                          de acordo com a transação correspondente na Google Play ou Stripe.
                        </li>
                        <li>
                          <span className="text-foreground font-bold">Sem Valor Monetário:</span>{" "}
                          Sob absolutamente nenhuma circunstância os créditos de varredura possuem
                          valor monetário reembolsável do ponto de vista cambial. Não podem ser
                          repassados, cedidos ou vendidos a outras contas ou convertidos em moeda
                          fiduciária.
                        </li>
                        <li>
                          <span className="text-foreground font-bold">Auditoria Antifraude:</span>{" "}
                          Qualquer exploração de vulnerabilidades para obter créditos gratuitos
                          ilicitamente resultará no banimento imediato e inapelável da conta com
                          perda total de registros históricos.
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Section 3 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <AlertOctagon className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        3. Restrições de Conduta e Segurança
                      </h2>
                    </div>
                    <div className="pl-10 space-y-2 text-xs md:text-sm">
                      <p>
                        A administração do SAR atua com tolerância zero em relação a condutas
                        maliciosas ou abusivas. É expressamente proibido:
                      </p>
                      <ul className="list-disc pl-5 space-y-1.5">
                        <li>
                          Utilizar o aplicativo por meio de bots, scripts de automação, emuladores
                          ou qualquer forma de acesso não autorizado por meio da interface móvel
                          padrão.
                        </li>
                        <li>
                          Realizar engenharia reversa no algoritmo de leitura da IA de fotos ou
                          forçar requisições diretas em nossas rotas de proxy de servidor público.
                        </li>
                        <li>
                          Fazer uploads sucessivos de conteúdo malicioso que não seja comida,
                          visando esgotar recursos de hardware ou sobrecarregar a nossa
                          infraestrutura.
                        </li>
                        <li>
                          Compartilhar credenciais de login ou vender contas clonadas com
                          privilégios Premium ativados de forma fraudulenta.
                        </li>
                      </ul>
                      <p className="text-xs text-destructive/90 font-bold mt-1">
                        O descumprimento de qualquer uma destas restrições resultará na suspensão
                        permanente imediata dos privilégios de acesso do utilizador.
                      </p>
                    </div>
                  </div>

                  {/* Section 4 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <LifeBuoy className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        4. Propriedade Intelectual e Suspensão de Serviço
                      </h2>
                    </div>
                    <p className="pl-10 text-xs md:text-sm">
                      Toda a propriedade intelectual do aplicativo, incluindo marcas, logotipos
                      (como a marca SAR), designs de interface, ilustrações, animações, bases de
                      alimentos, código-fonte e algoritmos proprietários de análise preditiva,
                      pertence unicamente a nós. O aplicativo concede ao usuário uma licença de uso
                      temporária, não exclusiva e revogável. Reservamo-nos o direito de alterar,
                      suspender ou descontinuar o serviço inteiro ou parte dele sem aviso prévio
                      para manutenção de sistemas de segurança.
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 text-[10px] md:text-xs text-center font-bold text-muted-foreground flex justify-between items-center px-2">
                  <span>Última atualização: Junho de 2026</span>
                  <span className="text-primary font-black">SAR COMPLIANCE</span>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="privacidade"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="bg-card rounded-[36px] p-6 md:p-8 space-y-6 md:space-y-8 border border-border shadow-sm">
                <div className="space-y-6 text-sm font-medium leading-relaxed text-muted-foreground">
                  {/* Secao 1 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Database className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        1. Coleta e Finalidade dos Dados
                      </h2>
                    </div>
                    <div className="pl-10 space-y-2 text-xs md:text-sm">
                      <p>
                        O aplicativo SAR atua em rigorosa conformidade com a proteção de dados (Lei
                        Geral de Proteção de Dados - LGPD brasileira e diretrizes do Google Play).
                        Coletamos e tratamos os seguintes dados necessários ao funcionamento do
                        Serviço:
                      </p>
                      <ul className="list-disc pl-5 space-y-1.5">
                        <li>
                          <span className="text-foreground font-bold">Identidade de Acesso:</span>{" "}
                          E-mail, senha criptografada e nome público de cadastro necessários para
                          criar e proteger o seu perfil de usuário exclusivo.
                        </li>
                        <li>
                          <span className="text-foreground font-bold">
                            Privacidade Nutricional:
                          </span>{" "}
                          Registro físico de metas (calorias estimadas, idade, peso corporal e
                          histórico diário de porções consumidas e registradas em seu Diário) para
                          refinar os relatórios e ajustes metabólicos do aplicativo.
                        </li>
                        <li>
                          <span className="text-foreground font-bold">Chat Funcional:</span>{" "}
                          Mensagens e textos trocados em nossos servidores para viabilizar as
                          interações sociais e o funcionamento integrado com o suporte ou agentes
                          assistentes.
                        </li>
                        <li>
                          <span className="text-foreground font-bold">Imagens do Scanner:</span> A
                          foto dos alimentos tirada ou anexada a fim de realizar o reconhecimento
                          visual computacional.
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Secao 2 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Lock className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        2. Processamento e Segurança Digital
                      </h2>
                    </div>
                    <div className="pl-10 space-y-2 text-xs md:text-sm">
                      <p>A segurança de dados e privacidade é uma de nossas maiores prioridades:</p>
                      <ul className="list-disc pl-5 space-y-1.5 font-semibold text-muted-foreground/90">
                        <li>
                          <span className="text-foreground font-bold">
                            IA Sem Identificação Pessoal:
                          </span>{" "}
                          Os arquivos de imagem do scanner de alimentos são enviados de modo
                          totalmente anônimo e criptografado para a API do Google Gemini. Nenhum
                          dado privado do usuário (como e-mail ou nome) é transmitido aos servidores
                          da Google durante a análise de alimentos.
                        </li>
                        <li>
                          <span className="text-foreground font-bold">Câmera e Mídia:</span> O
                          acesso à câmera ou galeria de fotos nas permissões do dispositivo é
                          empregado estritamente sob demanda para capturar a imagem do alimento e
                          cessa logo após o processamento da requisição técnica.
                        </li>
                        <li>
                          <span className="text-foreground font-bold">
                            Infraestrutura Blindada:
                          </span>{" "}
                          Todas as informações pessoais do usuário são armazenadas de modo seguro em
                          servidores dedicados e providos pela infraestrutura da Supabase, operando
                          com chaves assimétricas e proteção estrita de tabelas.
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Secao 3 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <UserCheck className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        3. Direitos de Exclusão Completa (Opt-Out)
                      </h2>
                    </div>
                    <p className="pl-10 text-xs md:text-sm">
                      Você é o proprietário dos seus dados pessoais. O utilizador poderá requerer a
                      exclusão completa e intransferível de todo o seu registro técnico a qualquer
                      momento. Ao excluir a conta, todos os dados identificadores, fotos carregadas,
                      histórico do Diário, chats fechados, fcm_tokens e senhas associadas são{" "}
                      <span className="text-rose-500 font-bold">
                        deletados permanentemente de nossos bancos de dados
                      </span>{" "}
                      dentro de minutos. Essa ação é definitiva e inviabiliza resgatar históricos
                      nutricionais anteriores.
                    </p>
                  </div>

                  {/* Secao 4 */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Shield className="size-4.5 text-primary" />
                      </div>
                      <h2 className="font-display font-extrabold text-base text-foreground">
                        4. Atualizações e Compartilhamento
                      </h2>
                    </div>
                    <p className="pl-10 text-xs md:text-sm">
                      Nós não comercializamos, barateamos ou repassamos seus dados cadastrais para
                      anunciantes terceiros. Informações agregadas e dados de consumo técnico
                      anônimo podem ser utilizados unicamente para melhoria dos modelos de
                      estimativa e recalibração do scanner. Esta política pode passar por revisões
                      futuras necessárias para se adaptar a novos decretos legais de proteção
                      cibernética.
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 text-[10px] md:text-xs text-center font-bold text-muted-foreground flex justify-between items-center px-2">
                  <span>LGPD & Proteção Google Play</span>
                  <span className="text-primary font-black font-display text-[9px] uppercase tracking-wider">
                    SAR SECURITY DEPT
                  </span>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back to Profile bottom button */}
        <div className="w-full text-center pt-2">
          <Button
            onClick={handleBack}
            className="rounded-[28px] h-12 w-full max-w-sm font-bold uppercase tracking-widest text-[10px] bg-primary text-primary-foreground hover:scale-[1.02] active:scale-95 transition-all shadow-[0_8px_20px_rgba(46,74,59,0.15)]"
            id="back-profile-btn"
          >
            {user ? "Voltar ao Meu Perfil" : "Ir para a Tela de Login"}
          </Button>
        </div>
      </div>
    </div>
  );
}
