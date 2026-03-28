'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import '@/v-pages/Landing.css';

export default function NextLanding() {
    const router = useRouter();
    const navigate = (to: string) => router.push(to);
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        let mounted = true;

        // Detect if there is an access_token in the URL (Google Login return)
        if (typeof window !== 'undefined' && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
            setIsRedirecting(true);
        }

        // Redirect if already logged in
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            if (session) {
                setIsRedirecting(true);
                router.replace('/dashboard');
            } else if (event === 'SIGNED_OUT') {
                setIsRedirecting(false);
            }
        });

        // Check current session immediately
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!mounted) return;
            if (session) {
                setIsRedirecting(true);
                router.replace('/dashboard');
            }
        });

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

        return () => {
            mounted = false;
            subscription.unsubscribe();
            obs.disconnect();
        };
    }, [router]);

    if (isRedirecting) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center space-y-2">
                    <p className="text-muted-foreground animate-pulse text-sm">Validando acesso...</p>
                    <p className="text-[10px] text-muted-foreground/50">Carregando painel Azura</p>
                </div>
            </div>
        );
    }

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

            {/* FOOTER */}
            <footer className="landing-footer">
                <div className="landing-container">
                    <div className="footer-inner">
                        <div className="footer-logo">Azura</div>
                        <div className="footer-copy">© 2026 Azura Gestão Gastronômica</div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
