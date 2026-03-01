import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Sparkles, Brain, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';

interface GlobalAIDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GlobalAIDialog({ open, onOpenChange }: GlobalAIDialogProps) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const recognitionRef = useRef<any>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const isSupported = typeof window !== 'undefined' &&
        (window.SpeechRecognition || (window as any).webkitSpeechRecognition);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) { }
        }
        setIsListening(false);
    }, []);

    const handleProcessCommand = async (text: string) => {
        if (!text.trim()) return;

        setIsProcessing(true);
        stopListening();

        try {
            // Get page context
            const pageContent = document.body.innerText.substring(0, 2000); // Simple context
            const currentPath = location.pathname;

            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-global-command`;
            console.log("Calling process-global-command:", functionUrl);

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
                },
                body: JSON.stringify({
                    text,
                    path: currentPath,
                    context: pageContent
                })
            });

            if (!response.ok) {
                throw new Error(`Cloud Error: ${response.status}`);
            }

            const data = await response.json();

            if (data.action === 'navigate') {
                navigate(data.target);
                toast.success(`Navegando para ${data.label || data.target}`);
            } else if (data.action === 'toast') {
                toast(data.message);
            } else if (data.message) {
                toast(data.message);
            }

            onOpenChange(false);
        } catch (err) {
            console.error('Error processing global AI command:', err);
            toast.error('Erro ao processar comando.');
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        if (!open || !isSupported) return;

        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'pt-BR';

        recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const transcriptText = event.results[current][0].transcript;
            setTranscript(transcriptText);

            if (event.results[current].isFinal) {
                handleProcessCommand(transcriptText);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        setTranscript('');

        return () => {
            recognition.abort();
        };
    }, [open, isSupported]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md border-primary/20 bg-background/95 backdrop-blur-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        Assistente Azura
                    </DialogTitle>
                    <DialogDescription>
                        Como posso te ajudar agora?
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-6 py-8">
                    <div className="relative">
                        {isProcessing ? (
                            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            </div>
                        ) : (
                            <Button
                                variant={isListening ? "destructive" : "default"}
                                size="lg"
                                className={`h-24 w-24 rounded-full shadow-lg transition-all ${isListening ? 'animate-pulse scale-110' : ''}`}
                                onClick={isListening ? stopListening : () => recognitionRef.current?.start()}
                            >
                                {isListening ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
                            </Button>
                        )}
                        {isListening && (
                            <div className="absolute -inset-4 rounded-full border-2 border-primary/20 animate-ping" />
                        )}
                    </div>

                    <div className="w-full text-center min-h-[3rem]">
                        {transcript ? (
                            <p className="text-lg font-medium animate-in fade-in slide-in-from-bottom-2">
                                "{transcript}"
                            </p>
                        ) : isListening ? (
                            <p className="text-muted-foreground italic">Ouvindo...</p>
                        ) : !isProcessing ? (
                            <p className="text-muted-foreground text-sm">Toque no microfone para falar</p>
                        ) : null}
                    </div>

                    {!isProcessing && (
                        <div className="flex flex-wrap justify-center gap-2">
                            <span className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground">"Ir para estoque"</span>
                            <span className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground">"Ver fichas técnicas"</span>
                            <span className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground">"Qual o custo do bolo?"</span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
