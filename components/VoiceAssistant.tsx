import React, { useState, useRef, useEffect } from 'react';
// FIX: Removed unexported 'LiveSession' type.
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAI_Blob } from '@google/genai';
import { CaseData } from '../types';
import { encode, decode, decodeAudioData, createDataSummaryForAI } from '../utils';

interface VoiceAssistantProps {
    data: CaseData[];
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ data }) => {
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [conversation, setConversation] = useState<{ speaker: 'user' | 'model', text: string }[]>([]);

    // FIX: Changed type from `Promise<LiveSession>` to `Promise<any>` because LiveSession is not an exported type.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    
    const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    
    // These need to be refs to persist across re-renders triggered by state changes
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const dataSummary = createDataSummaryForAI(data);
    const systemInstruction = `Eres un asistente de IA empático del Ministerio de la Defensa Pública. Tu propósito es ayudar a los usuarios a comprender los datos sobre sesgos en el sistema judicial, siempre desde una perspectiva de derechos humanos. Responde de manera clara, concisa y respetuosa, explicando conceptos complejos de forma sencilla. El usuario no puede verte, solo escucharte. Sé conversacional. Aquí tienes un resumen de los datos cargados actualmente para contextualizar tus respuestas: ${dataSummary}`;

    const startSession = async () => {
        if (!process.env.API_KEY) {
            alert("La clave de API no fue encontrada. Por favor, asegúrate de que esté configurada.");
            return;
        }
        setIsActive(true);
        setIsConnecting(true);
        setConversation([]);
        
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Tu navegador no soporta acceso al micrófono.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error("Tu navegador no soporta AudioContext.");
            }

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false);
                        setIsListening(true);
                        
                        try {
                            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                            mediaStreamSourceRef.current = source;

                            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                            scriptProcessorRef.current = scriptProcessor;

                            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                                try {
                                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                                    const pcmBlob = createBlob(inputData);
                                    sessionPromiseRef.current?.then((session) => {
                                        session.sendRealtimeInput({ media: pcmBlob });
                                    }).catch(console.error);
                                } catch (error) {
                                    console.error('Error processing audio:', error);
                                }
                            };
                            source.connect(scriptProcessor);
                            scriptProcessor.connect(inputAudioContextRef.current!.destination);
                        } catch (error) {
                            console.error('Error setting up audio processing:', error);
                            stopSession(true);
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        try {
                            if (message.serverContent?.modelTurn) setIsSpeaking(true);
                            if (message.serverContent?.turnComplete) setIsSpeaking(false);
                            
                            if (message.serverContent?.inputTranscription) {
                                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                            }
                            if (message.serverContent?.outputTranscription) {
                                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                            }
                            if(message.serverContent?.turnComplete) {
                                const fullInput = currentInputTranscriptionRef.current.trim();
                                const fullOutput = currentOutputTranscriptionRef.current.trim();
                                
                                if(fullInput){
                                    setConversation(prev => [...prev, { speaker: 'user', text: fullInput }]);
                                }
                                if(fullOutput){
                                    setConversation(prev => [...prev, { speaker: 'model', text: fullOutput }]);
                                }
                                currentInputTranscriptionRef.current = '';
                                currentOutputTranscriptionRef.current = '';
                            }

                            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                            if (audioData && outputAudioContextRef.current) {
                                const outputCtx = outputAudioContextRef.current;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                                
                                const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                                
                                const sourceNode = outputCtx.createBufferSource();
                                sourceNode.buffer = audioBuffer;
                                sourceNode.connect(outputCtx.destination);
                                
                                sourceNode.addEventListener('ended', () => {
                                    outputSourcesRef.current.delete(sourceNode);
                                });

                                sourceNode.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                outputSourcesRef.current.add(sourceNode);
                            }

                            if (message.serverContent?.interrupted) {
                                for (const source of outputSourcesRef.current.values()) {
                                    try {
                                        source.stop();
                                    } catch (e) { /* Ignore errors from stopping already stopped sources */ }
                                    outputSourcesRef.current.delete(source);
                                }
                                nextStartTimeRef.current = 0;
                            }
                        } catch (error) {
                            console.error('Error handling message:', error);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session Error:', e);
                        alert('Error en la sesión de voz. Por favor, inténtalo de nuevo.');
                        stopSession(true);
                    },
                    onclose: () => {
                        console.log('Session closed');
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: systemInstruction,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                }
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            const errorMessage = error instanceof Error ? error.message : "No se pudo iniciar la sesión de audio. Asegúrate de haber otorgado permiso para el micrófono.";
            alert(errorMessage);
            setIsActive(false);
            setIsConnecting(false);
        }
    };
    
    const stopSession = async (errorOccurred = false) => {
        if (!errorOccurred && sessionPromiseRef.current) {
            await sessionPromiseRef.current?.then((session) => session.close());
        }

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);

        sessionPromiseRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        mediaStreamRef.current = null;
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;

        setIsActive(false);
        setIsConnecting(false);
        setIsListening(false);
        setIsSpeaking(false);
    };
    
    const createBlob = (data: Float32Array): GenAI_Blob => {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = data[i] * 32768;
        }
        return {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
    };

    const toggleSession = () => {
        if (isActive) {
            stopSession();
        } else {
            startSession();
        }
    };
    
    const getStatusText = () => {
        if (isConnecting) return 'Conectando...';
        if (isSpeaking) return 'Hablando...';
        if (isListening) return 'Escuchando...';
        return 'Toca para finalizar';
    };

    return (
        <>
            <button
                onClick={toggleSession}
                className="no-print fixed bottom-8 right-8 bg-primary text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110 focus:outline-none z-50"
                aria-label="Asistente de Voz"
            >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
            </button>

            {isActive && (
                <div className="no-print fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40" onClick={e => { if(e.target === e.currentTarget) stopSession()}}>
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl h-3/4 flex flex-col">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-xl font-bold text-gray-800">Asistente de Voz Empático</h3>
                            <button onClick={() => stopSession()} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto my-4 pr-2 space-y-4">
                            {conversation.length === 0 && !isConnecting && (
                               <div className="text-center text-gray-500 pt-8">
                                   <p>Hola, soy tu asistente para el análisis de sesgos.</p>
                                   <p>¿Sobre qué te gustaría conversar?</p>
                               </div>
                            )}
                            {conversation.map((entry, index) => (
                                <div key={index} className={`flex flex-col ${entry.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`rounded-lg px-4 py-2 max-w-sm ${entry.speaker === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                                        {entry.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="text-center border-t pt-4 text-gray-600 font-medium">
                            {getStatusText()}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default VoiceAssistant;