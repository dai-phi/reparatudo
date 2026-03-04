import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wrench, Zap, Droplets, PaintBucket, Hammer, Shield, Star, Clock, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-handyman.jpg";

const services = [
  { icon: Zap, label: "Elétrica", color: "from-yellow-400 to-amber-500" },
  { icon: Droplets, label: "Hidráulica", color: "from-blue-400 to-cyan-500" },
  { icon: PaintBucket, label: "Pintura", color: "from-pink-400 to-rose-500" },
  { icon: Hammer, label: "Montagem", color: "from-orange-400 to-red-500" },
  { icon: Wrench, label: "Reparos", color: "from-emerald-400 to-green-500" },
];

const stats = [
  { value: "5.000+", label: "Profissionais" },
  { value: "50.000+", label: "Serviços realizados" },
  { value: "4.8", label: "Avaliação média", icon: Star },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">FixJá</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/provider/register">
              <Button variant="ghost" size="sm">Sou Profissional</Button>
            </Link>
            <Link to="/client/register">
              <Button variant="hero" size="sm">Preciso de Ajuda</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0" style={{ backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />
        <div className="container relative z-10 py-24 md:py-36">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/20 text-accent text-sm font-medium mb-6">
                <MapPin className="w-4 h-4" /> Profissionais perto de você
              </span>
              <h1 className="font-display text-4xl md:text-6xl font-bold text-primary-foreground leading-tight mb-6">
                Seu problema resolvido em{" "}
                <span className="text-gradient-accent">minutos</span>
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/70 mb-8 max-w-lg">
                Conectamos você a profissionais qualificados para qualquer reparo ou manutenção na sua casa. Rápido, seguro e avaliado.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/client/register">
                  <Button variant="hero" size="xl">
                    Chamar Marido de Aluguel
                  </Button>
                </Link>
                <Link to="/provider/register">
                  <Button variant="hero-outline" size="xl">
                    Quero Trabalhar
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-b border-border">
        <div className="container">
          <div className="grid grid-cols-3 gap-8">
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="font-display text-3xl md:text-4xl font-bold text-foreground">{stat.value}</span>
                  {stat.icon && <Star className="w-6 h-6 text-accent fill-accent" />}
                </div>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-foreground mb-3">Serviços Disponíveis</h2>
            <p className="text-muted-foreground">Encontre o profissional certo para cada necessidade</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {services.map((service, i) => (
              <motion.div
                key={service.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group cursor-pointer"
              >
                <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-card shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center`}>
                    <service.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-card-foreground">{service.label}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-12">Como Funciona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: MapPin, step: "01", title: "Informe sua localização", desc: "Compartilhe onde você está para encontrar profissionais próximos" },
              { icon: Wrench, step: "02", title: "Escolha o serviço", desc: "Selecione o tipo de reparo que precisa e descreva o problema" },
              { icon: Clock, step: "03", title: "Receba atendimento", desc: "Um profissional aceita e vem até você. Converse pelo chat integrado" },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative p-8 rounded-2xl bg-card shadow-card"
              >
                <span className="font-display text-5xl font-bold text-accent/15">{item.step}</span>
                <div className="mt-2">
                  <item.icon className="w-8 h-8 text-accent mb-3" />
                  <h3 className="font-display text-xl font-bold text-card-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="rounded-3xl bg-gradient-hero p-12 md:p-16 text-center">
            <Shield className="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Profissionais verificados e avaliados
            </h2>
            <p className="text-primary-foreground/70 max-w-lg mx-auto mb-8">
              Todos os profissionais passam por verificação. Você acompanha avaliações reais de outros clientes.
            </p>
            <Link to="/client/register">
              <Button variant="hero" size="xl">Começar Agora</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-accent flex items-center justify-center">
              <Wrench className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">FixJá</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 FixJá. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
