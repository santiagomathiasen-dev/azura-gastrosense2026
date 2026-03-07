'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './Landing.css';

export default function Landing() {
    const router = useRouter();
    const navigate = (to: string) => router.push(to);

    useEffect(() => {
        const reveals = document.querySelectorAll('.reveal');
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    setTimeout(() => entry.target.classList.add('visible'), i * 80);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        reveals.forEach(el => obs.observe(el));

        // Cleanup intersection observer
        return () => obs.disconnect();
    }, []);

    const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const target = document.querySelector(id);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="landing-page">
            <div className="bg-pattern"></div>

            {/* NAV */}
            <nav className="landing-nav">
                <div className="landing-container">
                    <div className="nav-inner">
                        <a href="#" className="logo">Azura<div className="logo-dot"></div></a>
                        <ul className="nav-links">
                            <li><a href="#funcionalidades" onClick={(e) => handleSmoothScroll(e, '#funcionalidades')}>Funcionalidades</a></li>
                            <li><a href="#ia" onClick={(e) => handleSmoothScroll(e, '#ia')}>Inteligência Artificial</a></li>
                            <li><a href="#precos" onClick={(e) => handleSmoothScroll(e, '#precos')}>Preços</a></li>
                            <li><a href="#depoimentos" onClick={(e) => handleSmoothScroll(e, '#depoimentos')}>Clientes</a></li>
                        </ul>
                        <div className="nav-actions">
                            <button className="btn-text" onClick={() => navigate('/auth')}>Entrar</button>
                            <button className="btn-fill" onClick={() => navigate('/auth')}>Testar grátis</button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* HERO */}
            <section className="hero">
                <div className="landing-container">
                    <div className="hero-inner">
                        <div>
                            <div className="hero-tag"><span className="hero-tag-dot"></span>Gestão Gastronômica com IA</div>
                            <h1>Cozinha sob<br /><em>controle total.</em><br /><span className="thin">Resultados reais.</span></h1>
                            <p className="hero-desc">Da compra automática à produção inteligente — a Azura conecta estoque, vendas e cozinha em uma plataforma impulsionada por inteligência artificial.</p>
                            <div className="hero-ctas">
                                <button className="cta-primary" onClick={() => navigate('/auth')}>
                                    Começar grátis
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </button>
                                <button className="cta-secondary" onClick={(e) => {
                                    const target = document.querySelector('#ia');
                                    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="currentColor" /></svg>
                                    Ver demonstração
                                </button>
                            </div>
                            <div className="hero-social">
                                <div className="avatars">
                                    <div className="av">RC</div><div className="av av2">MF</div><div className="av av3">JL</div><div className="av av4">AT</div>
                                </div>
                                <div className="social-text">Usado por <strong>+1.200 estabelecimentos</strong><br />em todo o Brasil</div>
                            </div>
                        </div>

                        <div className="hero-visual">
                            <div className="float-badge">
                                <div className="fb-icon">
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.8 5h5.2l-4.2 3 1.6 5L9 12.3l-4.4 2.7 1.6-5L2 7h5.2L9 2z" stroke="#b87333" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                                </div>
                                <div>
                                    <div className="fb-label">Economia gerada</div>
                                    <div className="fb-val">R$ 12.400 / mês</div>
                                </div>
                            </div>
                            <div className="dash-wrap">
                                <div className="dash-topbar">
                                    <div className="dash-topbar-dots"><div className="dtd r"></div><div className="dtd y"></div><div className="dtd g"></div></div>
                                    <div className="dash-topbar-title">azura · painel operacional</div>
                                    <div className="dash-topbar-badge">● AO VIVO</div>
                                </div>
                                <div className="dash-body">
                                    <div className="dash-kpis">
                                        <div className="kpi"><div className="kpi-label">Produção hoje</div><div className="kpi-value">248</div><div className="kpi-sub">▲ 12% vs ontem</div></div>
                                        <div className="kpi"><div className="kpi-label">Custo/prato</div><div className="kpi-value">R$8,40</div><div className="kpi-sub">▼ 3% vs meta</div></div>
                                        <div className="kpi"><div className="kpi-label">Estoque</div><div className="kpi-value">96%</div><div className="kpi-sub">Abastecido</div></div>
                                    </div>
                                    <div className="dash-row">
                                        <div className="dash-panel">
                                            <div className="dp-title">Produção — 7 dias</div>
                                            <div className="mini-chart">
                                                <div className="bar" style={{ height: '40%' }}></div>
                                                <div className="bar" style={{ height: '60%' }}></div>
                                                <div className="bar" style={{ height: '45%' }}></div>
                                                <div className="bar" style={{ height: '80%' }}></div>
                                                <div className="bar" style={{ height: '65%' }}></div>
                                                <div className="bar active" style={{ height: '90%' }}></div>
                                                <div className="bar" style={{ height: '75%' }}></div>
                                            </div>
                                        </div>
                                        <div className="dash-panel">
                                            <div className="dp-title">Insumos críticos</div>
                                            <div className="mini-list">
                                                <div className="ml-item"><div className="ml-dot" style={{ background: '#1b5e3f' }}></div><span className="ml-name">Frango kg</span><span className="ml-qty">42kg</span><span className="ml-status ok">OK</span></div>
                                                <div className="ml-item"><div className="ml-dot" style={{ background: '#b87333' }}></div><span className="ml-name">Azeite L</span><span className="ml-qty">3.2L</span><span className="ml-status low">Baixo</span></div>
                                                <div className="ml-item"><div className="ml-dot" style={{ background: '#1b5e3f' }}></div><span className="ml-name">Arroz kg</span><span className="ml-qty">110kg</span><span className="ml-status ok">OK</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="dash-ai-row">
                                        <div className="ai-icon">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="white" strokeWidth="1.5" /><path d="M8 5v3l2 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                        </div>
                                        <div className="ai-text">
                                            <div className="ai-label">Azura IA</div>
                                            <div className="ai-msg">Compra automática de azeite agendada para amanhã — 8L previsto para o fim de semana.</div>
                                        </div>
                                        <div className="ai-badge">Auto</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* LOGOS */}
            <div className="logos-bar">
                <div className="landing-container">
                    <div className="logos-inner">
                        <span className="logos-label">Presente em</span>
                        <div className="logo-pill">Outback</div>
                        <div className="logo-pill">Giraffas</div>
                        <div className="logo-pill">Montana</div>
                        <div className="logo-pill">Madero</div>
                        <div className="logo-pill">Coco Bambu</div>
                        <div className="logo-pill">Spoleto</div>
                    </div>
                </div>
            </div>

            {/* FEATURES */}
            <section className="section" id="funcionalidades">
                <div className="landing-container">
                    <div className="reveal">
                        <div className="section-tag">Funcionalidades</div>
                        <h2>Tudo o que sua operação<br /><em>precisa, integrado.</em></h2>
                        <p className="section-sub">Da gestão de insumos ao planejamento automático de compras — cada módulo foi projetado para cozinhas profissionais.</p>
                    </div>
                    <div className="features-grid reveal">
                        <div className="feat-card">
                            <div className="feat-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="4" rx="1" /><rect x="3" y="10" width="12" height="4" rx="1" /><rect x="3" y="17" width="8" height="4" rx="1" /></svg></div>
                            <h3>Gestão de Produção</h3>
                            <p>Controle total do que entra e sai da sua cozinha. Acompanhe cada etapa da produção com rastreabilidade completa em tempo real.</p>
                            <span className="feat-tag">Tempo Real</span>
                        </div>
                        <div className="feat-card">
                            <div className="feat-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" /></svg></div>
                            <h3>Planejamento de Produção</h3>
                            <p>Organize a produção da semana com base nas vendas previstas, eventos agendados e histórico de demanda.</p>
                            <span className="feat-tag">Planejamento</span>
                        </div>
                        <div className="feat-card">
                            <div className="feat-icon gold-icon"><svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg></div>
                            <h3>Compras Automáticas</h3>
                            <p>A IA analisa seu estoque, histórico e demanda futura e gera pedidos de compra automaticamente para os fornecedores certos.</p>
                            <span className="feat-tag gold">IA Integrada</span>
                        </div>
                        <div className="feat-card">
                            <div className="feat-icon"><svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></div>
                            <h3>IA com Base em Vendas</h3>
                            <p>Produção planejada automaticamente cruzando histórico de vendas, sazonalidade e eventos para evitar desperdício e falta.</p>
                            <span className="feat-tag">Inteligente</span>
                        </div>
                        <div className="feat-card">
                            <div className="feat-icon"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27,6.96 12,12.01 20.73,6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg></div>
                            <h3>Estoques Multinível</h3>
                            <p>Controle separado de estoque central, insumos de produção e produtos acabados com alertas automáticos de reposição.</p>
                            <span className="feat-tag">Multinível</span>
                        </div>
                        <div className="feat-card">
                            <div className="feat-icon gold-icon"><svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg></div>
                            <h3>Cadastro por Voz</h3>
                            <p>Dite ingredientes, receitas e entradas de estoque por voz. A IA interpreta, categoriza e registra tudo automaticamente.</p>
                            <span className="feat-tag gold">Inovação</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* AI SECTION */}
            <section className="ai-section" id="ia">
                <div className="landing-container">
                    <div className="ai-inner">
                        <div className="reveal">
                            <div className="ai-tag"><span className="ai-tag-dot"></span>Inteligência Artificial</div>
                            <h2>A IA que<br /><em>pensa pela</em><br />sua cozinha.</h2>
                            <p className="ai-desc">Não é só automação — é uma plataforma que aprende com sua operação e toma decisões inteligentes para reduzir custos e aumentar eficiência.</p>
                            <div className="ai-features">
                                <div className="ai-feat">
                                    <div className="ai-feat-icon"><svg viewBox="0 0 24 24"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" /><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" /><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" /><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" /><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" /><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z" /><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z" /></svg></div>
                                    <div>
                                        <div className="ai-feat-title">Cadastro Automático por IA</div>
                                        <div className="ai-feat-desc">Tire foto de uma nota fiscal ou lista de ingredientes — a IA cadastra tudo automaticamente.</div>
                                    </div>
                                </div>
                                <div className="ai-feat">
                                    <div className="ai-feat-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg></div>
                                    <div>
                                        <div className="ai-feat-title">Previsão de Demanda</div>
                                        <div className="ai-feat-desc">Modelo preditivo ajustado ao seu perfil de vendas, dias da semana e sazonalidade.</div>
                                    </div>
                                </div>
                                <div className="ai-feat">
                                    <div className="ai-feat-icon"><svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 010 8h-1" /><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg></div>
                                    <div>
                                        <div className="ai-feat-title">Alertas Proativos</div>
                                        <div className="ai-feat-desc">Notificações antes do problema acontecer — ruptura, vencimento e desvio de custo.</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="reveal">
                            <div className="terminal">
                                <div className="term-bar">
                                    <div className="term-dots"><div className="td r"></div><div className="td y"></div><div className="td g"></div></div>
                                    <span className="term-title">azura-ai · terminal</span>
                                </div>
                                <div className="term-body">
                                    <div className="t-line"><span className="t-prompt">›</span><span className="t-cmd">analisando vendas semana 12…</span></div>
                                    <div className="t-out">Prato mais vendido: <span className="t-hi">Risoto de Camarão</span></div>
                                    <div className="t-out">Demanda estimada: <span className="t-hi">184 porções</span> (sex–dom)</div>
                                    <br />
                                    <div className="t-line"><span className="t-prompt">›</span><span className="t-cmd">verificando estoque de insumos…</span></div>
                                    <div className="t-out">Camarão: <span className="t-hi">12kg</span> (necessário: 36kg)</div>
                                    <div className="t-out">Arroz arbóreo: <span className="t-hi">8kg</span> (necessário: 18kg)</div>
                                    <br />
                                    <div className="t-line"><span className="t-prompt">›</span><span className="t-cmd">gerando pedido automático…</span></div>
                                    <div className="t-out">→ Fornecedor Marisco SP: <span className="t-hi">24kg camarão</span></div>
                                    <div className="t-out">→ Distribuidora Grano: <span className="t-hi">10kg arbóreo</span></div>
                                    <br />
                                    <div className="t-line"><span className="t-prompt">›</span><span className="t-cmd">status</span></div>
                                    <div className="t-out"><span className="t-ok">✓ Pedidos enviados automaticamente</span></div>
                                    <div className="t-out"><span className="t-ok">✓ Produção programada para sex 08:00</span></div>
                                    <div className="t-out"><span className="t-hi">Economia estimada: R$ 340</span><span className="t-cursor"></span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* PRICING */}
            <section className="section" id="precos">
                <div className="landing-container">
                    <div className="reveal" style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto' }}>
                        <div className="section-tag" style={{ justifyContent: 'center' }}>Preços</div>
                        <h2>Simples, <em>justo</em> e escalável.</h2>
                        <p className="section-sub" style={{ margin: '0 auto' }}>Sem surpresas na fatura. Escolha o plano certo para o tamanho da sua operação.</p>
                    </div>
                    <div className="pricing-grid reveal">
                        <div className="price-card">
                            <div className="price-tier">Starter</div>
                            <div className="price-val">R$299</div>
                            <div className="price-per">/ mês por unidade</div>
                            <div className="price-desc">Ideal para restaurantes e lanchonetes que querem começar a organizar a gestão.</div>
                            <ul className="feat-list">
                                <li className="feat-included">Gestão de produção básica</li>
                                <li className="feat-included">Controle de estoque central</li>
                                <li className="feat-included">Cadastro por voz</li>
                                <li className="feat-included">Relatórios mensais</li>
                                <li className="feat-included">Suporte por chat</li>
                            </ul>
                            <button className="price-cta-btn outline" onClick={() => navigate('/auth')}>Começar grátis</button>
                        </div>
                        <div className="price-card featured">
                            <div className="price-popular">Mais popular</div>
                            <div className="price-tier">Profissional</div>
                            <div className="price-val">R$699</div>
                            <div className="price-per">/ mês por unidade</div>
                            <div className="price-desc">Para operações que precisam de automação completa e inteligência preditiva.</div>
                            <ul className="feat-list">
                                <li className="feat-included">Tudo do Starter</li>
                                <li className="feat-included">Planejamento automático de compras</li>
                                <li className="feat-included">IA de previsão de demanda</li>
                                <li className="feat-included">Estoque multinível</li>
                                <li className="feat-included">Planejamento de produção por IA</li>
                                <li className="feat-included">Integração com PDV</li>
                            </ul>
                            <button className="price-cta-btn" onClick={() => navigate('/auth')}>Assinar agora</button>
                        </div>
                        <div className="price-card">
                            <div className="price-tier">Enterprise</div>
                            <div className="price-val">Custom</div>
                            <div className="price-per">por rede / grupo</div>
                            <div className="price-desc">Para redes e grupos com múltiplas unidades, cozinha central e necessidades específicas.</div>
                            <ul className="feat-list">
                                <li className="feat-included">Tudo do Profissional</li>
                                <li className="feat-included">Múltiplas unidades centralizadas</li>
                                <li className="feat-included">Cozinha central integrada</li>
                                <li className="feat-included">API e integrações customizadas</li>
                                <li className="feat-included">Gerente de conta dedicado</li>
                            </ul>
                            <button className="price-cta-btn outline">Falar com vendas</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section className="section" id="depoimentos" style={{ background: 'var(--white)' }}>
                <div className="landing-container">
                    <div className="reveal" style={{ textAlign: 'center', maxWidth: '520px', margin: '0 auto' }}>
                        <div className="section-tag" style={{ justifyContent: 'center' }}>Depoimentos</div>
                        <h2>Quem usa,<br /><em>não volta atrás.</em></h2>
                    </div>
                    <div className="testi-grid reveal">
                        <div className="testi-card">
                            <div className="testi-stars">★★★★★</div>
                            <p className="testi-quote">"Reduzimos o desperdício em 34% no primeiro mês. A IA de compras nos surpreendeu desde a primeira semana."</p>
                            <div className="testi-author">
                                <div className="testi-av" style={{ background: '#1b5e3f' }}>RC</div>
                                <div><div className="testi-name">Ricardo Carvalho</div><div className="testi-role">Chef Executivo · Restaurante Varanda, SP</div></div>
                            </div>
                        </div>
                        <div className="testi-card">
                            <div className="testi-stars">★★★★★</div>
                            <p className="testi-quote">"Com 12 unidades, a Azura nos deu visibilidade que nunca tivemos. O painel centralizado mudou tudo."</p>
                            <div className="testi-author">
                                <div className="testi-av" style={{ background: '#b87333' }}>MF</div>
                                <div><div className="testi-name">Marina Figueiredo</div><div className="testi-role">Diretora de Operações · Rede Sabor&Arte</div></div>
                            </div>
                        </div>
                        <div className="testi-card">
                            <div className="testi-stars">★★★★★</div>
                            <p className="testi-quote">"O cadastro por voz foi divisor de águas. Minha equipe não precisou aprender nada — só falar naturalmente."</p>
                            <div className="testi-author">
                                <div className="testi-av" style={{ background: '#2d7a56' }}>JL</div>
                                <div><div className="testi-name">João Lima</div><div className="testi-role">Proprietário · Bistrô Folha Verde, RJ</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA FINAL */}
            <section className="cta-final">
                <div className="landing-container">
                    <h2>Pronto para transformar<br />sua <em>gestão gastronômica?</em></h2>
                    <p>14 dias grátis. Sem cartão de crédito. Cancele quando quiser.</p>
                    <div className="final-btns">
                        <button className="btn-white" onClick={() => navigate('/auth')}>
                            Criar conta grátis
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <button className="btn-ghost-white">Agendar demonstração</button>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="landing-footer">
                <div className="landing-container">
                    <div className="footer-inner">
                        <div className="footer-logo">Azura</div>
                        <ul className="footer-links">
                            <li><a href="#">Produto</a></li>
                            <li><a href="#">Preços</a></li>
                            <li><a href="#">Blog</a></li>
                            <li><a href="#">Contato</a></li>
                            <li><a href="#">Privacidade</a></li>
                        </ul>
                        <div className="footer-copy">© 2026 Azura Gestão Gastronômica</div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
