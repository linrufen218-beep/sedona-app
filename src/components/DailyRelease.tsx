import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { analyzeReleaseText } from '@/services/geminiService';
import { AppSettings, saveRecord, WantType, addStuckSentence, getComponentState, saveComponentState, STORAGE_KEYS } from '@/lib/store';
import { Loader2, Plus, CheckCircle2, RefreshCcw, ArrowRight, ArrowLeft, X, Zap, LogOut, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const WANT_LABELS: Record<WantType, string> = {
  approval: '想要被认可',
  control: '想要控制',
  security: '想要安全',
};

const SIX_STEPS = [
  "你必须想要‘波澜不惊’超过你想要‘被认可’、‘控制’或‘安全’吗？",
  "你决定通过释放来达到‘波澜不惊’吗？",
  "你能看到所有这些情绪感受都源自这三个想要吗？你能立即释放它们吗？",
  "你愿意在任何时候，无论独处或人前，都持续释放这些想要吗？",
  "如果你现在感到‘卡住了’，你愿意放开对这个‘卡住’的想要控制吗？",
  "你现在感到更轻松、更快乐了一点吗？"
];

const THREE_STEPS = [
  "你允许这种感觉存在吗？",
  "你能识别出这是哪种‘想要’吗？",
  "你允许自己放下它吗？"
];

export default function DailyRelease({ settings }: { settings?: AppSettings }) {
  const [text, setText] = useState(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.text || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.analysis || null);
  const [step, setStep] = useState<'input' | 'analysis' | 'release'>(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.step || 'input');
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.currentSentenceIndex || 0);
  const [sixStepIndex, setSixStepIndex] = useState(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.sixStepIndex || 0);
  const [activeSteps, setActiveSteps] = useState<string[]>(SIX_STEPS);
  const [isSequential, setIsSequential] = useState(true);
  const [isSentenceFinished, setIsSentenceFinished] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [skippedIndices, setSkippedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.skippedIndices || []);
  const [releasedIndices, setReleasedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.releasedIndices || []);
  const [isMoreReleaseOpen, setIsMoreReleaseOpen] = useState(false);
  const [moreReleaseEmotion, setMoreReleaseEmotion] = useState('');
  const [moreReleaseWants, setMoreReleaseWants] = useState<WantType[]>([]);

  // Save state on changes
  useEffect(() => {
    saveComponentState(STORAGE_KEYS.DAILY_STATE, {
      text,
      analysis,
      step,
      currentSentenceIndex,
      releasedIndices,
      skippedIndices,
      sixStepIndex
    });
  }, [text, analysis, step, currentSentenceIndex, releasedIndices, skippedIndices, sixStepIndex]);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setStep('analysis');
    setAnalysis({ list: [], ana: '' });
    setReleasedIndices([]);
    setSkippedIndices([]);
    setCurrentSentenceIndex(0);
    setSixStepIndex(0);
    try {
      const result = await analyzeReleaseText(
        text, 
        (partial) => {
          setAnalysis(partial);
        },
        {
          model_type: settings.selectedModel
        }
      );
      setAnalysis(result);
      
      // Auto save record after successful analysis
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'daily',
        content: text,
        analysis: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(error);
      alert('分析失败，请检查 Worker 配置或网络');
      setStep('input');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleWant = (sentenceIndex: number, want: WantType) => {
    const newAnalysis = { ...analysis };
    const wants = [...newAnalysis.list[sentenceIndex].w];
    if (wants.includes(want)) {
      newAnalysis.list[sentenceIndex].w = wants.filter((w: string) => w !== want);
    } else {
      newAnalysis.list[sentenceIndex].w = [...wants, want];
    }
    setAnalysis(newAnalysis);
  };

  const removeSentence = (index: number) => {
    const newAnalysis = { ...analysis };
    newAnalysis.list.splice(index, 1);
    
    // Adjust released and skipped indices
    const newReleased = releasedIndices
      .filter(i => i !== index)
      .map(i => i > index ? i - 1 : i);
    const newSkipped = skippedIndices
      .filter(i => i !== index)
      .map(i => i > index ? i - 1 : i);
    
    setReleasedIndices(newReleased);
    setSkippedIndices(newSkipped);

    if (newAnalysis.list.length === 0) {
      reset();
    } else {
      setAnalysis(newAnalysis);
      // Check if all remaining are processed
      if (newAnalysis.list.length > 0 && newReleased.length + newSkipped.length === newAnalysis.list.length) {
        finishAll();
      }
    }
  };

  const startRelease = (index: number, mode: 'sequential' | 'single') => {
    setStep('release');
    setCurrentSentenceIndex(index);
    setSixStepIndex(0);
    setIsSequential(mode === 'sequential');
    setIsSentenceFinished(false);
    if (mode === 'sequential') {
      setSkippedIndices([]);
      setReleasedIndices([]);
    }
    // First sentence in sequential mode uses 6 steps, others use 3 steps
    if (mode === 'sequential' && index === 0) {
      setActiveSteps(SIX_STEPS);
    } else {
      setActiveSteps(THREE_STEPS);
    }
  };

  const getButtonLabels = () => {
    const stepText = activeSteps[sixStepIndex];
    if (stepText.includes('允许') || stepText.includes('能')) {
      return { primary: '能 / 允许', secondary: '不能 / 不允许' };
    }
    if (stepText.includes('愿意')) {
      return { primary: '愿意', secondary: '不愿意' };
    }
    if (stepText.includes('什么时候')) {
      return { primary: '现在', secondary: '稍后 / 不知道' };
    }
    return { primary: '能 / 允许', secondary: '不能 / 不允许' };
  };

  const nextStep = () => {
    if (sixStepIndex < activeSteps.length - 1) {
      setSixStepIndex(sixStepIndex + 1);
    } else {
      setIsSentenceFinished(true);
    }
  };

  const continueRelease = () => {
    const newReleased = [...releasedIndices, currentSentenceIndex];
    setReleasedIndices(newReleased);
    setIsSentenceFinished(false);
    
    if (currentSentenceIndex < analysis.list.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
      setSixStepIndex(0);
      setActiveSteps(THREE_STEPS); // Following sentences always use 3 steps
    } else {
      // Finished current sentences
      if (isAnalyzing) {
        setStep('analysis');
      } else {
        finishAll();
      }
    }
  };

  const reRelease = () => {
    setSixStepIndex(0);
    setIsSentenceFinished(false);
  };

  const handleMoreRelease = () => {
    if (!moreReleaseEmotion.trim() || moreReleaseWants.length === 0) return;
    
    const newAnalysis = { ...analysis };
    newAnalysis.list[currentSentenceIndex] = {
      ...newAnalysis.list[currentSentenceIndex],
      s: `(深入) ${moreReleaseEmotion}`,
      w: moreReleaseWants,
      a: `针对“${moreReleaseEmotion}”的进一步释放`
    };
    
    setAnalysis(newAnalysis);
    setMoreReleaseEmotion('');
    setMoreReleaseWants([]);
    setIsMoreReleaseOpen(false);
    reRelease();
  };

  const toggleMoreWant = (want: WantType) => {
    setMoreReleaseWants(prev => 
      prev.includes(want) ? prev.filter(w => w !== want) : [...prev, want]
    );
  };

  const skipSentence = () => {
    const newSkipped = [...skippedIndices, currentSentenceIndex];
    setSkippedIndices(newSkipped);
    if (currentSentenceIndex < analysis.list.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
      setSixStepIndex(0);
      setActiveSteps(THREE_STEPS);
    } else {
      // Finished current sentences
      if (isAnalyzing) {
        setStep('analysis');
      } else {
        finishAll();
      }
    }
  };

  const finishAll = () => {
    handleManualSave();
    reset();
  };

  const handleManualSave = () => {
    if (!analysis) return;
    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'daily',
      content: text,
      analysis: analysis,
      timestamp: Date.now(),
    });
    alert('记录已手动保存');
  };

  const handleQuit = (moveToStuck: boolean) => {
    if (moveToStuck) {
      // Find unreleased and skipped sentences
      analysis.list.forEach((s: any, i: number) => {
        if (!releasedIndices.includes(i)) {
          addStuckSentence({
            text: s.s,
            wants: s.w,
            analysis: s.a,
            source: '日常释放'
          });
        }
      });
    }
    reset();
    setShowQuitDialog(false);
  };

  const reset = () => {
    setStep('input');
    setText('');
    setAnalysis(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {step === 'input' && (
          <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="py-4 md:py-6">
                <CardTitle className="text-xl md:text-2xl font-serif text-foreground">记录当下的感受</CardTitle>
                <CardDescription className="text-xs md:text-sm">你可以释放任何负面或正面的情绪。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 relative px-3 md:px-6 pb-6">
                <Textarea
                  placeholder="我现在感到..."
                  className="min-h-[220px] md:min-h-[250px] text-base md:text-lg leading-relaxed resize-none bg-background/50 border-border/50 focus-visible:ring-accent"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <Button 
                  className="w-full h-12 md:h-14 text-base md:text-lg font-medium bg-primary hover:bg-accent text-primary-foreground transition-all duration-300" 
                  disabled={isAnalyzing || !text.trim()}
                  onClick={handleAnalyze}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 md:h-6 md:w-6 animate-spin" />
                      AI 深度分析中...
                    </>
                  ) : (
                    '开始深度分析'
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'analysis' && analysis && (
          <motion.div key="analysis" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 md:space-y-6 px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="py-4 md:py-6">
                <CardTitle className="text-lg md:text-xl font-serif">分析结果与调整</CardTitle>
                <CardDescription className="text-xs md:text-sm">AI 深度揭示潜意识想要。点击“+”号可手动调整。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6 px-3 md:px-6 pb-6">
                <div className="flex flex-col gap-3">
                  <Button 
                    className="w-full h-11 md:h-12 bg-primary hover:bg-accent text-primary-foreground shadow-lg gap-2 text-sm" 
                    onClick={() => startRelease(0, 'sequential')}
                    disabled={!analysis.list || analysis.list.length === 0}
                  >
                    <RefreshCcw className="w-4 h-4" /> {isAnalyzing ? '开始释放 (同步分析中...)' : '开始释放 (全部顺序)'}
                  </Button>
                </div>

                <ScrollArea className="h-[350px] md:h-[400px] pr-2 md:pr-4">
                  <div className="space-y-4">
                    {analysis.list && analysis.list.map((s: any, i: number) => (
                      <div key={i} className={`p-4 rounded-xl border border-border/30 group space-y-2 relative ${releasedIndices.includes(i) ? 'opacity-50 bg-muted/20' : 'bg-background/40'}`}>
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] md:text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest leading-none">第 {i + 1} 句</span>
                            {releasedIndices.includes(i) && <Badge variant="outline" className="text-[8px] h-4 px-1 border-green-500 text-green-500">已释放</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {s.w && s.w.map((w: WantType) => (
                              <Badge key={w} variant="secondary" className="bg-secondary/20 text-foreground border-none px-1.5 py-0 text-[8px] md:text-[9px] flex items-center gap-1">
                                {WANT_LABELS[w]}
                                <X className="w-2 h-2 cursor-pointer hover:text-destructive" onClick={() => toggleWant(i, w)} />
                              </Badge>
                            ))}
                            <Popover>
                              <PopoverTrigger render={
                                <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full bg-primary/10 hover:bg-primary/20">
                                  <Plus className="w-2.5 h-2.5" />
                                </Button>
                              } />
                              <PopoverContent className="w-40 p-1.5 bg-popover/95 backdrop-blur-sm border-border/50">
                                <div className="flex flex-col gap-0.5">
                                  {(Object.keys(WANT_LABELS) as WantType[]).map((w) => (
                                    <Button 
                                      key={w} 
                                      variant="ghost" 
                                      size="sm" 
                                      className={`justify-start font-normal text-[10px] h-7 ${s.w && s.w.includes(w) ? 'bg-accent/20 text-accent' : ''}`}
                                      onClick={() => toggleWant(i, w)}
                                    >
                                      {WANT_LABELS[w]}
                                    </Button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        
                        <p className="text-[13px] md:text-sm text-foreground/90 leading-snug font-serif italic">"{s.s}"</p>
                        
                        {s.a && (
                          <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
                            <p className="text-[11px] md:text-[12px] text-muted-foreground leading-relaxed">
                              <span className="font-bold text-accent mr-1 uppercase text-[9px] tracking-tight">潜意识解析:</span> {s.a}
                            </p>
                          </div>
                        )}
                        
                        <div className="pt-1 flex gap-2">
                          <Button 
                            variant="outline"
                            className="flex-[2] border-accent/30 hover:bg-accent/10 text-accent rounded-xl h-9 gap-2 text-xs"
                            onClick={() => startRelease(i, 'single')}
                          >
                            <Zap className="w-3.5 h-3.5" /> 快速释放
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 border-border/30 hover:bg-muted text-muted-foreground rounded-xl h-9 text-xs"
                            onClick={() => removeSentence(i)}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    ))}
                    {isAnalyzing && (
                      <div className="p-5 rounded-2xl bg-accent/5 border border-dashed border-accent/20 animate-pulse flex items-center justify-center h-24">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-accent" />
                          <p className="text-[10px] text-accent font-medium">AI 正在深度分析中...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                <div className="p-4 md:p-5 rounded-xl bg-secondary/10 border border-secondary/20 min-h-[80px]">
                  <h4 className="font-bold text-[11px] md:text-sm mb-2 text-secondary-foreground flex items-center gap-2 uppercase tracking-wide">
                    <RefreshCcw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isAnalyzing ? 'animate-spin' : ''}`} /> 执念根底总结
                  </h4>
                  {isAnalyzing && (!analysis.ana || analysis.ana.length < 5) ? (
                    <div className="flex items-center gap-2 text-muted-foreground animate-pulse mt-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[11px]">正在深度分析整体执念...</span>
                    </div>
                  ) : (
                    <p className="text-xs md:text-sm leading-relaxed opacity-90 text-foreground/80 italic">{analysis.ana}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button variant="outline" className="flex-1 h-11 md:h-12 border-primary/30 hover:bg-primary/10 text-xs md:text-sm" onClick={() => { reset(); setStep('input'); }}>
                    清空并重新输入
                  </Button>
                  <Button variant="secondary" className="flex-1 h-11 md:h-12 border-accent/30 hover:bg-accent/10 text-xs md:text-sm" onClick={handleManualSave}>
                    <Save className="w-4 h-4 mr-2" /> 手动保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'release' && analysis && (
          <motion.div key="release" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="flex flex-col items-center justify-center min-h-[85vh] md:min-h-[70vh] text-center space-y-8 md:space-y-12 relative px-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-2 top-2 md:right-0 md:top-0 text-muted-foreground hover:text-destructive"
              onClick={() => setShowQuitDialog(true)}
            >
              <LogOut className="w-6 h-6" />
            </Button>

            <div className="space-y-4 md:space-y-6 max-w-xl">
              <div className="flex flex-col items-center gap-2">
                <Badge variant="outline" className="px-3 md:px-4 py-1 border-accent/50 text-accent text-[10px] md:text-xs">
                  句子 {currentSentenceIndex + 1} / {analysis.list.length}
                </Badge>
                <div className="flex gap-1">
                  {analysis.list[currentSentenceIndex].w.map((w: WantType) => (
                    <span key={w} className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-tighter">
                      #{WANT_LABELS[w]}
                    </span>
                  ))}
                </div>
              </div>
              <h2 className="text-[18px] md:text-[20px] font-serif font-medium leading-relaxed text-foreground px-2">
                "{analysis.list[currentSentenceIndex].s}"
              </h2>
              {analysis.list[currentSentenceIndex].a && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="text-[11px] md:text-sm text-muted-foreground italic max-w-sm mx-auto bg-background/50 p-3 rounded-xl border border-border/20 shadow-sm"
                >
                  <span className="font-bold text-accent mr-1 uppercase text-[9px] block mb-1">潜意识解析</span>
                  {analysis.list[currentSentenceIndex].a}
                </motion.div>
              )}
            </div>

            <div className="space-y-8 md:space-y-10 w-full max-w-sm md:max-w-md bg-card/40 p-6 md:p-8 rounded-3xl backdrop-blur-sm border border-border/20 shadow-2xl">
              <AnimatePresence mode="wait">
                {!isSentenceFinished ? (
                  <motion.div key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8 md:space-y-10">
                    <div className="space-y-1 md:space-y-2">
                      <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-widest">
                        {activeSteps.length === 6 ? '六步骤' : '三步骤'} - Step {sixStepIndex + 1}
                      </p>
                      <AnimatePresence mode="wait">
                        <motion.div key={sixStepIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-lg md:text-xl font-medium text-foreground leading-snug min-h-[70px] flex items-center justify-center px-4">
                          {activeSteps[sixStepIndex]}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="flex flex-col gap-3 md:gap-4">
                      <Button size="lg" className="h-12 md:h-14 text-base md:text-lg rounded-2xl bg-primary hover:bg-accent text-primary-foreground shadow-lg transition-all" onClick={nextStep}>
                        {getButtonLabels().primary}
                      </Button>
                      <Button variant="outline" className="h-12 md:h-14 text-base md:text-lg rounded-2xl border-border hover:bg-muted text-muted-foreground transition-all" onClick={nextStep}>
                        {getButtonLabels().secondary}
                      </Button>
                      <button 
                        className="text-[10px] text-muted-foreground hover:text-accent transition-colors underline underline-offset-4"
                        onClick={skipSentence}
                      >
                        先不释放，跳到下一句
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="choice" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 md:space-y-8">
                    <div className="space-y-1">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                      </div>
                      <h3 className="text-lg md:text-xl font-medium">本点释放完成</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">您感觉如何？</p>
                    </div>
                    <div className="flex flex-col gap-2 md:gap-3">
                      <Button size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-accent text-primary-foreground text-sm md:text-base" onClick={continueRelease}>
                        继续释放下一句
                      </Button>
                      <Button variant="outline" size="lg" className="h-12 md:h-14 rounded-2xl border-accent/30 text-accent hover:bg-accent/10 text-sm md:text-base" onClick={reRelease}>
                        重新释放本句
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="text-accent hover:text-accent/80 flex items-center gap-2 text-[11px] md:text-sm h-8 md:h-10"
                        onClick={() => setIsMoreReleaseOpen(true)}
                      >
                        <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" /> 释放更多 (探索底层想要)
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-3">
              {activeSteps.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${i === sixStepIndex ? 'bg-accent w-8' : 'bg-muted'}`} 
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认退出释放？</DialogTitle>
            <DialogDescription>
              您还有未完成释放的句子。是否需要将这些句子移动到“化解卡住”板块，以便日后处理？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleQuit(false)}>
              直接退出
            </Button>
            <Button className="flex-1 bg-accent hover:bg-accent/80" onClick={() => handleQuit(true)}>
              移动到“化解卡住”并退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoreReleaseOpen} onOpenChange={setIsMoreReleaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" /> 释放更多
            </DialogTitle>
            <DialogDescription>
              深入挖掘当前感受背后的底层想要。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>现在的感受/情绪是什么？</Label>
              <Input 
                placeholder="例如：感到隐约的焦虑、不知所措..." 
                value={moreReleaseEmotion}
                onChange={(e) => setMoreReleaseEmotion(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>这背后对应哪些“想要”？</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WANT_LABELS) as WantType[]).map(w => (
                  <Button
                    key={w}
                    variant={moreReleaseWants.includes(w) ? 'default' : 'outline'}
                    size="sm"
                    className={`rounded-full ${moreReleaseWants.includes(w) ? 'bg-accent hover:bg-accent/90' : ''}`}
                    onClick={() => toggleMoreWant(w)}
                  >
                    {WANT_LABELS[w]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-white h-12 rounded-xl"
              disabled={!moreReleaseEmotion.trim() || moreReleaseWants.length === 0}
              onClick={handleMoreRelease}
            >
              开始深入分析释放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
