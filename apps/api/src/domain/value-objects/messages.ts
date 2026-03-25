export const apiMessages = {
    request: {
      notFound: "Pedido não encontrado",
      alreadyAccepted: "Pedido já aceito",
      alreadyRejected: "Pedido já recusado",
      alreadyCompleted: "Pedido já finalizado",
      alreadyCancelled: "Pedido já cancelado",
      alreadyConfirmed: "Pedido já confirmado",
      alreadyCreated: "Pedido já criado",
      alreadyAssigned: "Pedido já atribuido",
    },
    chat: {
      notFound: "Conversa não encontrada",
      alreadyClosed: "Conversa já encerrada",
      closed: "Conversa encerrada",
    },
    auth: {
      notFound: "Usuário não encontrado",
      alreadyLoggedIn: "Usuário já logado",
      alreadyRegistered: "Usuário já registrado",
    },
    user: {
      notFound: "Usuário não encontrado",
    },
    provider: {
      notFound: "Prestador não encontrado",
      cepNotRegistered: "CEP do prestador não cadastrado",
      outOfRadius: "Prestador fora do raio de atendimento",
    },
    client: {
      notFound: "Cliente não encontrado",
      cepNotRegistered: "CEP do cliente não cadastrado",
    },
    service: {
      notFound: "Serviço não encontrado",
    },
  } as const;

  export const NO_DESCRIPTION = "Sem descrição";
  export const UNAUTHORIZED = "Não autorizado";