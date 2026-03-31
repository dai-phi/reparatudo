export const UI_MESSAGES = {
  request: {
    newRequestFrom: (clientName: string) => `Novo pedido de ${clientName}`,
    acceptedAndChatOpened: "Pedido aceito! Chat aberto com o cliente.",
    rejected: "Pedido recusado.",
    cancelled: "Atendimento cancelado.",
    completed: "Atendimento finalizado com sucesso.",
    confirmedService: "Serviço confirmado!",
    createdAndWaitingProvider: "Pedido enviado! Aguardando o aceite do prestador.",
    providerRejectedOrCancelled: "Prestador recusou ou cancelou o pedido.",
    completedAndRatePrompt: "Serviço finalizado! Avalie o prestador abaixo (opcional).",
    waitingProviderResponse: "Aguardando resposta do prestador",
    providerNameLoading: "Carregando prestador…",
    viewInRequestedServices: "Ver em Serviços Solicitados",
    cancelPendingRequest: "Cancelar pedido",
    cancelPendingConfirmTitle: "Cancelar este pedido?",
    cancelPendingConfirmDescription:
      "O pedido deixará de ficar em aberto e o prestador será notificado. Pode solicitar outro serviço depois.",
    pendingRedirectHint: "Quando o prestador aceitar, você será levado ao chat automaticamente.",
  },
  chat: {
    serviceCancelled: "Serviço cancelado.",
    serviceCompleted: "Serviço finalizado!",
  },
  auth: {
    loginSuccess: "Login realizado!",
    clientRegisterSuccess: "Cadastro realizado!",
    providerRegisterSuccess: "Cadastro realizado com sucesso!",
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
    pixCodeCopied: "Código copiado!",
  },
  validation: {
    selectService: "Selecione um serviço",
    selectRating: "Selecione uma nota",
  },
} as const;

export const UI_ERRORS = {
  request: {
    accept: "Não foi possível aceitar o pedido",
    reject: "Não foi possível recusar o pedido",
    complete: "Não foi possível finalizar o atendimento",
    cancel: "Não foi possível cancelar o atendimento",
    confirm: "Não foi possível confirmar o serviço",
    create: "Não foi possível criar o pedido",
  },
  chat: {
    sendMessage: "Não foi possível enviar a mensagem",
    confirmService: "Não foi possível confirmar o serviço",
    cancelService: "Não foi possível cancelar o serviço",
    completeService: "Não foi possível finalizar o serviço",
  },
  auth: {
    login: "Não foi possível entrar",
    register: "Não foi possível concluir o cadastro",
  },
  profile: {
    update: "Não foi possível atualizar o perfil",
  },
  rating: {
    submit: "Não foi possível enviar a avaliação",
    providerResponse: "Não foi possível enviar a resposta",
  },
  incident: {
    submit: "Não foi possível reportar o problema",
  },
  billing: {
    pay: "Não foi possível concluir o pagamento",
    copyPix: "Não foi possível copiar",
  },
} as const;