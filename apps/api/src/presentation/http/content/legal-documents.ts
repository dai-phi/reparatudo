/** LGPD base copy (PT-BR) — versioned for transparency. */

export const LEGAL_VERSION = "2026-03-31";

export const legalDocuments = {
  terms: {
    slug: "terms",
    title: "Termos de uso",
    version: LEGAL_VERSION,
    updatedAt: "2026-03-31",
    sections: [
      {
        heading: "Objeto",
        body:
          "A plataforma Repara Tudo conecta clientes a prestadores de serviços. O uso do serviço implica aceitação destes termos.",
      },
      {
        heading: "Conta e responsabilidades",
        body:
          "Você é responsável pela veracidade dos dados informados, pela segurança da sua senha e pelas interações com outros usuários. É proibido uso fraudulento, ofensivo ou que viole a lei.",
      },
      {
        heading: "Serviços e contratação",
        body:
          "A negociação e execução do serviço ocorre entre cliente e prestador. A plataforma facilita o contato; a relação civil e tributária do serviço é entre as partes, salvo disposição legal em contrário.",
      },
      {
        heading: "Limitação",
        body:
          "Na medida permitida pela lei aplicável, a plataforma não se responsabiliza por danos indiretos ou por descumprimento entre as partes. Funcionalidades podem evoluir ou ser descontinuadas com aviso razoável quando possível.",
      },
      {
        heading: "Contato",
        body:
          "Dúvidas sobre estes termos podem ser enviadas pelo canal de suporte indicado no aplicativo ou site.",
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Política de privacidade",
    version: LEGAL_VERSION,
    updatedAt: "2026-03-31",
    sections: [
      {
        heading: "Controlador e bases legais",
        body:
          "Tratamos dados pessoais para cadastro, autenticação, prestação do serviço da plataforma, segurança, cumprimento de obrigação legal e legítimo interesse (ex.: prevenção a fraudes e melhoria do serviço), conforme a LGPD.",
      },
      {
        heading: "Dados que podemos tratar",
        body:
          "Incluem identificação, contato, endereço, documentos quando necessários à verificação do prestador, dados de uso, logs técnicos e, quando aplicável, conteúdo de mensagens no aplicativo.",
      },
      {
        heading: "Compartilhamento",
        body:
          "Dados podem ser compartilhados com prestadores ou clientes conforme necessário à operação do pedido, com provedores de infraestrutura (hospedagem, e-mail) e quando exigido por autoridade competente.",
      },
      {
        heading: "Direitos do titular",
        body:
          "Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação de dados desnecessários, informação sobre compartilhamentos e revogação de consentimento quando aplicável, nos limites legais.",
      },
      {
        heading: "Encarregado (DPO)",
        body:
          "O contato do encarregado de dados, quando houver, será publicado no site/app. Enquanto não houver canal dedicado, use o suporte geral da plataforma.",
      },
    ],
  },
  retention: {
    slug: "retention",
    title: "Retenção de dados",
    version: LEGAL_VERSION,
    updatedAt: "2026-03-31",
    sections: [
      {
        heading: "Princípios",
        body:
          "Mantemos dados apenas pelo tempo necessário às finalidades descritas na política de privacidade, ao cumprimento legal, resolução de disputas e segurança.",
      },
      {
        heading: "Prazos orientativos",
        body:
          "Conta e perfil: enquanto a conta estiver ativa e, após encerramento, pelo prazo legal de guarda (ex.: obrigações fiscais ou defesa em processo). Pedidos, mensagens e registros operacionais: período necessário à prestação do serviço e resolução de incidentes, em geral até alguns anos salvo exclusão antecipada quando permitido. Logs de segurança e auditoria: prazo limitado compatível com investigação e conformidade.",
      },
      {
        heading: "Exclusão",
        body:
          "Solicitações de exclusão serão atendidas quando não houver base legal ou contratual para manutenção. Alguns registros podem ser anonimizados em vez de apagados.",
      },
    ],
  },
} as const;
