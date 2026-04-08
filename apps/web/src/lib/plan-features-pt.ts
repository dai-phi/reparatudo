/** Traducao de beneficios de plano (legado em ingles no banco / cache). */
const LEGACY_PLAN_FEATURE_PT: Record<string, string> = {
  "Receive service requests on the platform": "Receber solicitacoes de servico na plataforma",
  "Manage profile, statement and history": "Gerir perfil, extrato e historico de atendimentos",
  "Maintain an active monthly subscription": "Manter assinatura mensal ativa",
  "Access the premium provider plan tier": "Acesso ao nivel premium de planos para prestadores",
};

export function planFeatureLabelPt(text: string): string {
  return LEGACY_PLAN_FEATURE_PT[text] ?? text;
}
