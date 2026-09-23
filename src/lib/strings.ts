export const strings = {
  common: {
    appName: "NutriScan AI",
    loading: "Carregando...",
    save: "Salvar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    error: "Erro",
    success: "Sucesso",
    back: "Voltar",
    close: "Fechar",
  },
  auth: {
    loginTitle: "Entrar na sua conta",
    emailPlaceholder: "seu@email.com",
    passwordPlaceholder: "Sua senha",
    loginButton: "Entrar",
  },
  profile: {
    title: "Perfil",
    editProfile: "Editar Perfil",
    adminPanel: "Painel de Administração",
    subscriptions: "Assinaturas",
    rewards: "Recompensas",
    history: "Histórico de Leitura",
    goals: "Metas Diárias",
    objective: "Objetivo",
    physicalData: "Dados Físicos",
    handCalibration: "Calibração da Mão (Alta Precisão)",
    changePassword: "Alterar Senha",
    notifications: "Configurações de Notificação",
    privacy: "Direitos e Privacidade",
    deleteAccount: "Excluir Conta",
    signOut: "Sair da Conta",
  },
  search: {
    title: "Buscar Alimento",
    placeholder: "Digite o alimento ou prato...",
    aiSearch: "Busca Inteligente por IA",
    recent: "Buscas Recentes",
  },
  scanner: {
    title: "Scanner Nutricional",
    instructions: "Aponte a câmera para o prato ou alimento",
    takePhoto: "Tirar Foto",
    gallery: "Galeria",
  },
  chat: {
    title: "Nutricionista IA",
    placeholder: "Pergunte ao seu nutricionista...",
    send: "Enviar",
  },
};

export function t(path: string): string {
  const keys = path.split(".");
  let current: any = strings;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}
