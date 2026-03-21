export enum ServicesTypes {
  ELETRICA = "Elétrica",
  HIDRAULICA = "Hidráulica",
  PINTURA = "Pintura",
  MONTAGEM = "Montagem",
  REPAROS = "Reparos Gerais",
}

export enum ServicesDescriptions {
  ELETRICA = "Tomadas, fiação, disjuntores",
  HIDRAULICA = "Vazamentos, encanamento",
  PINTURA = "Paredes, tetos, fachadas",
  MONTAGEM = "Móveis, prateleiras",
  REPAROS = "Diversos serviços",
}

export enum RequestStatusLabels {
  NEW = "Novo pedido",
  WAITING_PROVIDER = "Aguardando prestador",
  IN_NEGOTIATION = "Em negociação",
  IN_SERVICE = "Em atendimento",
  COMPLETED = "Finalizado",
  CANCELLED = "Cancelado pelo cliente",
  REJECTED = "Recusado pelo prestador",
}



export enum PaymentMethodsLabels {
  PIX = "PIX",
  CREDIT_CARD = "Cartão de crédito",
  DEBIT_CARD = "Cartão de débito",
}

export enum PaymentStatusLabels {
  PAID = "Pago",
  PENDING = "Pendente",
  CANCELLED = "Cancelado",
}