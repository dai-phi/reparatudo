export const UI_MESSAGES = {
  request: {
    newRequestFrom: (clientName: string) => `Novo pedido de ${clientName}`,
    acceptedAndChatOpened: "Pedido aceito! Chat aberto com o cliente.",
    rejected: "Pedido recusado.",
    cancelled: "Atendimento cancelado.",
    completed: "Atendimento finalizado com sucesso.",
    confirmedService: "Servico confirmado!",
    createdAndWaitingProvider: "Pedido enviado! Aguardando o aceite do prestador.",
    providerRejectedOrCancelled: "Prestador recusou ou cancelou o pedido.",
    completedAndRatePrompt: "Servico finalizado! Avalie o prestador abaixo (opcional).",
    waitingProviderResponse: "Aguardando resposta do prestador",
    providerNameLoading: "Carregando prestador...",
    viewInRequestedServices: "Ver em Servicos Solicitados",
    cancelPendingRequest: "Cancelar pedido",
    cancelPendingConfirmTitle: "Cancelar este pedido?",
    cancelPendingConfirmDescription:
      "O pedido deixara de ficar em aberto e o prestador sera notificado. Pode solicitar outro servico depois.",
    pendingRedirectHint: "Quando o prestador aceitar, voce sera levado ao chat automaticamente.",
  },
  chat: {
    serviceCancelled: "Servico cancelado.",
    serviceCompleted: "Servico finalizado!",
  },
  auth: {
    loginSuccess: "Login realizado!",
    clientRegisterSuccess: "Cadastro realizado!",
    providerRegisterSuccess: "Cadastro realizado com sucesso!",
    passwordResetSuccess: "Senha alterada! Faça login com a nova senha.",
  },
  profile: {
    updated: "Perfil atualizado!",
  },
  rating: {
    submitted: "Avaliação enviada! Obrigado.",
    providerResponseSubmitted: "Resposta enviada para a avaliação.",
  },
  incident: {
    submitted: "Problema reportado com sucesso. Nossa equipe vai analisar.",
  },
  billing: {
    paymentRegistered: "Pagamento registrado com sucesso!",
    pixCodeCopied: "Codigo copiado!",
  },
  plans: {
    purchaseCompleted: "Plano registrado com sucesso!",
    pixCodeCopied: "Codigo PIX copiado!",
  },
  providerAccount: {
    photoUpdated: "Foto de perfil atualizada.",
    photoRemoved: "Foto de perfil removida.",
    documentUploaded: "Documento enviado com sucesso.",
    selfieUploaded: "Selfie enviada com sucesso.",
    verifiedPhotoHint: "Conta verificada — tudo certo com seu perfil.",
    verifiedKycTitle: "Conta verificada",
    verifiedKycDescription:
      "Sua identidade ja foi conferida. Nao e necessario enviar novos documentos ou selfies.",
  },
  validation: {
    selectService: "Selecione um servico",
    selectRating: "Selecione uma nota",
    descriptionRequired: "Descreva o problema para continuar",
  },
} as const;

export const UI_ERRORS = {
  request: {
    accept: "Nao foi possivel aceitar o pedido",
    reject: "Nao foi possivel recusar o pedido",
    complete: "Nao foi possivel finalizar o atendimento",
    cancel: "Nao foi possivel cancelar o atendimento",
    confirm: "Nao foi possivel confirmar o servico",
    create: "Nao foi possivel criar o pedido",
  },
  chat: {
    sendMessage: "Nao foi possivel enviar a mensagem",
    confirmService: "Nao foi possivel confirmar o servico",
    cancelService: "Nao foi possivel cancelar o servico",
    completeService: "Nao foi possivel finalizar o servico",
  },
  auth: {
    login: "Nao foi possivel entrar",
    register: "Nao foi possivel concluir o cadastro",
    forgotPassword: "Nao foi possivel enviar o e-mail de recuperacao",
    resetPassword: "Nao foi possivel redefinir a senha",
  },
  profile: {
    update: "Nao foi possivel atualizar o perfil",
  },
  rating: {
    submit: "Não foi possível enviar a avaliação",
    providerResponse: "Não foi possível enviar a resposta",
  },
  incident: {
    submit: "Não foi possível reportar o problema",
  },
  billing: {
    pay: "Nao foi possivel concluir o pagamento",
    copyPix: "Nao foi possivel copiar",
  },
  plans: {
    purchase: "Nao foi possivel concluir a compra do plano",
    copyPix: "Nao foi possivel copiar o codigo PIX",
  },
  providerAccount: {
    photoUpload: "Nao foi possivel enviar a foto de perfil.",
    photoRemove: "Nao foi possivel remover a foto de perfil.",
    documentUpload: "Nao foi possivel enviar o documento.",
    selfieUpload: "Nao foi possivel enviar a selfie.",
    verificationSubmit: "Nao foi possivel enviar o pedido de verificacao.",
    verificationLoad: "Nao foi possivel carregar os dados de verificacao.",
  },
} as const;
